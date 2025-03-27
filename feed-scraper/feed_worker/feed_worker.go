package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/mmcdole/gofeed"
	amqp "github.com/rabbitmq/amqp091-go"
)

type Feed struct {
	AutoDescription string `json:"auto_description"`
	AutoImageUrl    string `json:"auto_image_url"`
	AutoTitle       string `json:"auto_title"`
	CreatedAt       string `json:"created_at"`
	FeedUrl         string `json:"feed_url"`
	HashId          string `json:"hash_id"`
	ID              int    `json:"id"`
	LastFetchedAt   string `json:"last_fetched_at"`
	SiteUrl         string `json:"site_url"`
}

type Post struct {
	Title       string `json:"title"`
	Content     string `json:"content"`
	URL         string `json:"url"`
	PublishedAt string `json:"published_at"`
	GUID        string `json:"guid"`
	BlogID      int    `json:"blog_id"`
}

type AppMetrics struct {
	LastSuccessfulRun   atomic.Value
	ProcessedFeedsCount atomic.Int64
	ProcessedPostsCount atomic.Int64
	ErrorCount          atomic.Int64
	IsHealthy           atomic.Bool
	RabbitMQConnected   atomic.Bool
	DbConnected         atomic.Bool
	LastConnectionTime  atomic.Value
}

var metrics AppMetrics
var db *sql.DB

func failOnError(err error, msg string) {
	if err != nil {
		metrics.ErrorCount.Add(1)
		metrics.IsHealthy.Store(false)
		log.Panicf("%s: %s", msg, err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if strings.Contains(r.Header.Get("Accept"), "application/openmetrics-text") {
		w.Header().Set("Content-Type", "application/openmetrics-text;version=1.0.0;charset=utf-8")

		fmt.Fprintf(w, "# HELP feed_worker_healthy Whether the feed worker is healthy\n")
		fmt.Fprintf(w, "# TYPE feed_worker_healthy gauge\n")
		if metrics.IsHealthy.Load() {
			fmt.Fprintf(w, "feed_worker_healthy 1\n")
		} else {
			fmt.Fprintf(w, "feed_worker_healthy 0\n")
		}

		fmt.Fprintf(w, "# HELP feed_worker_last_successful_run_timestamp_seconds Unix timestamp of last successful run\n")
		fmt.Fprintf(w, "# TYPE feed_worker_last_successful_run_timestamp_seconds gauge\n")
		fmt.Fprintf(w, "feed_worker_last_successful_run_timestamp_seconds %d\n",
			metrics.LastSuccessfulRun.Load().(time.Time).Unix())

		fmt.Fprintf(w, "# HELP feed_worker_processed_feeds_total Total number of feeds processed\n")
		fmt.Fprintf(w, "# TYPE feed_worker_processed_feeds_total counter\n")
		fmt.Fprintf(w, "feed_worker_processed_feeds_total %d\n",
			metrics.ProcessedFeedsCount.Load())

		fmt.Fprintf(w, "# HELP feed_worker_processed_posts_total Total number of posts processed\n")
		fmt.Fprintf(w, "# TYPE feed_worker_processed_posts_total counter\n")
		fmt.Fprintf(w, "feed_worker_processed_posts_total %d\n",
			metrics.ProcessedPostsCount.Load())

		fmt.Fprintf(w, "# HELP feed_worker_errors_total Total number of errors encountered\n")
		fmt.Fprintf(w, "# TYPE feed_worker_errors_total counter\n")
		fmt.Fprintf(w, "feed_worker_errors_total %d\n",
			metrics.ErrorCount.Load())

		fmt.Fprintf(w, "# HELP feed_worker_rabbitmq_connected Whether RabbitMQ is connected\n")
		fmt.Fprintf(w, "# TYPE feed_worker_rabbitmq_connected gauge\n")
		if metrics.RabbitMQConnected.Load() {
			fmt.Fprintf(w, "feed_worker_rabbitmq_connected 1\n")
		} else {
			fmt.Fprintf(w, "feed_worker_rabbitmq_connected 0\n")
		}

		fmt.Fprintf(w, "# HELP feed_worker_db_connected Whether the database is connected\n")
		fmt.Fprintf(w, "# TYPE feed_worker_db_connected gauge\n")
		if metrics.DbConnected.Load() {
			fmt.Fprintf(w, "feed_worker_db_connected 1\n")
		} else {
			fmt.Fprintf(w, "feed_worker_db_connected 0\n")
		}

		fmt.Fprintf(w, "# EOF\n")
		return
	}

	status := struct {
		Status              string    `json:"status"`
		LastSuccessfulRun   time.Time `json:"lastSuccessfulRun"`
		ProcessedFeedsCount int64     `json:"processedFeedsCount"`
		ProcessedPostsCount int64     `json:"processedPostsCount"`
		ErrorCount          int64     `json:"errorCount"`
		RabbitMQConnected   bool      `json:"rabbitMQConnected"`
		LastConnectionTime  time.Time `json:"lastConnectionTime"`
	}{
		Status:              "healthy",
		LastSuccessfulRun:   metrics.LastSuccessfulRun.Load().(time.Time),
		ProcessedFeedsCount: metrics.ProcessedFeedsCount.Load(),
		ProcessedPostsCount: metrics.ProcessedPostsCount.Load(),
		ErrorCount:          metrics.ErrorCount.Load(),
		RabbitMQConnected:   metrics.RabbitMQConnected.Load(),
		LastConnectionTime:  metrics.LastConnectionTime.Load().(time.Time),
	}

	if !metrics.IsHealthy.Load() || !metrics.RabbitMQConnected.Load() {
		status.Status = "unhealthy"
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func getPublishedAt(item *gofeed.Item) time.Time {
	var publishedAt time.Time
	if item.PublishedParsed != nil {
		publishedAt = *item.PublishedParsed
	} else if item.Published != "" {
		publishedAt, _ = time.Parse(time.RFC3339, item.Published)
	} else {
		publishedAt = time.Now()
	}
	return publishedAt
}

func connectToRabbitMQ(rabbitmqUser, rabbitmqPassword, rabbitmqHost string) (*amqp.Connection, *amqp.Channel, error) {
	conn, err := amqp.Dial(fmt.Sprintf("amqp://%s:%s@%s:5672/", rabbitmqUser, rabbitmqPassword, rabbitmqHost))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to connect to RabbitMQ: %v", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("failed to open channel: %v", err)
	}

	err = ch.Qos(1, 0, false)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, nil, fmt.Errorf("failed to set QoS: %v", err)
	}

	return conn, ch, nil
}

func setupConsumer(ch *amqp.Channel, queueName string) (<-chan amqp.Delivery, error) {
	return ch.Consume(
		queueName,
		"",    // consumer
		false, // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,   // args
	)
}

func hashString(input string) string {
	hasher := sha256.New()
	hasher.Write([]byte(input))
	hashBytes := hasher.Sum(nil)
	return hex.EncodeToString(hashBytes)
}

func connectToDatabase(connStr string) (*sql.DB, error) {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	err = db.Ping()
	if err != nil {
		return nil, err
	}

	return db, nil
}

func generatePostGUID(post Post) (string, error) {
	if post.GUID != "" {
		return post.GUID, nil
	}

	if post.URL != "" {
		return post.URL, nil
	}

	publishedAt, err := time.Parse(time.RFC3339, post.PublishedAt)
	if err != nil {
		return "", fmt.Errorf("error parsing published date: %w", err)
	}

	input := post.Title + fmt.Sprintf("%d", publishedAt.UnixMilli())
	return hashString(input), nil
}

func getPostByGuid(guid string, blogId int) (bool, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM posts WHERE guid = $1 AND blog_id = $2", guid, blogId).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func createPost(post Post) (int, error) {
	var id int
	publishedAt, err := time.Parse(time.RFC3339, post.PublishedAt)
	if err != nil {
		return 0, fmt.Errorf("invalid published_at date: %v", err)
	}

	// Insert the post
	err = db.QueryRow(`
		INSERT INTO posts (
			blog_id,
			title,
			content,
			url,
			published_at,
			guid,
			created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, post.BlogID, post.Title, post.Content, post.URL, publishedAt, post.GUID, time.Now()).Scan(&id)

	if err != nil {
		return 0, err
	}

	return id, nil
}

func updateBlogLastFetchedAt(blogId int) error {
	_, err := db.Exec("UPDATE blogs SET last_fetched_at = $1 WHERE id = $2",
		time.Now().Format(time.RFC3339), blogId)
	return err
}

func updateBlogPostsLastMonth(blogId int) error {
	_, err := db.Exec(`
		UPDATE blogs
		SET posts_last_month = (
			SELECT COUNT(*)
			FROM posts
			WHERE blog_id = $1
			AND published_at >= (CURRENT_TIMESTAMP - INTERVAL '1 month')
		)
		WHERE id = $1
	`, blogId)
	return err
}

func updateBlogLastPublishedAt(blogId int) error {
	_, err := db.Exec(`
		UPDATE blogs
		SET last_published_at = (
			SELECT MAX(published_at)
			FROM posts
			WHERE blog_id = $1
		)
		WHERE id = $1
	`, blogId)
	return err
}

func updateBlogStats(blogId int) error {
	err := updateBlogLastFetchedAt(blogId)
	if err != nil {
		return err
	}

	err = updateBlogPostsLastMonth(blogId)
	if err != nil {
		return err
	}

	err = updateBlogLastPublishedAt(blogId)
	if err != nil {
		return err
	}

	return nil
}

func main() {
	err := godotenv.Load()
	failOnError(err, "Failed to load .env file")

	rabbitmqUser := os.Getenv("RABBITMQ_USER")
	rabbitmqPassword := os.Getenv("RABBITMQ_PASSWORD")
	rabbitmqHost := os.Getenv("RABBITMQ_HOST")

	metrics.LastSuccessfulRun.Store(time.Time{})
	metrics.LastConnectionTime.Store(time.Time{})
	metrics.RabbitMQConnected.Store(false)
	metrics.DbConnected.Store(false)
	metrics.IsHealthy.Store(false)
	metrics.ErrorCount.Store(0)

	dbUrl := os.Getenv("DATABASE_URL")
	var dbErr error
	db, dbErr = connectToDatabase(dbUrl)
	if dbErr != nil {
		log.Printf("Failed to connect to database: %v", dbErr)
		metrics.DbConnected.Store(false)
		metrics.IsHealthy.Store(false)
	} else {
		metrics.DbConnected.Store(true)
		log.Printf("Connected to database")
	}

	go func() {
		http.HandleFunc("/health", healthHandler)
		if err := http.ListenAndServe(":8090", nil); err != nil {
			log.Printf("Health check server error: %v", err)
		}
	}()

	fp := gofeed.NewParser()

	for {
		conn, ch, err := connectToRabbitMQ(rabbitmqUser, rabbitmqPassword, rabbitmqHost)
		if err != nil {
			log.Printf("Failed to connect to RabbitMQ: %v", err)
			metrics.IsHealthy.Store(false)
			time.Sleep(5 * time.Second)
			continue
		}

		feedQueue, err := ch.QueueDeclare(
			"feed_queue", // name
			true,         // durable
			false,        // delete when unused
			false,        // exclusive
			false,        // no-wait
			nil,          // arguments
		)
		if err != nil {
			log.Printf("Failed to declare feed queue: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		postQueue, err := ch.QueueDeclare(
			"post_queue", // name
			true,         // durable
			false,        // delete when unused
			false,        // exclusive
			false,        // no-wait
			nil,          // arguments
		)
		if err != nil {
			log.Printf("Failed to declare post queue: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		msgs, err := setupConsumer(ch, feedQueue.Name)
		if err != nil {
			log.Printf("Failed to set up consumer: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		connClose := make(chan *amqp.Error)
		conn.NotifyClose(connClose)

		go func() {
			for d := range msgs {
				func() {
					defer func() {
						if r := recover(); r != nil {
							metrics.ErrorCount.Add(1)
							metrics.IsHealthy.Store(false)
							log.Printf("Recovered from panic: %v", r)
						}
					}()

					log.Printf("Received a message: %s", d.Body)
					var feedData Feed
					err := json.Unmarshal(d.Body, &feedData)
					if err != nil {
						metrics.ErrorCount.Add(1)
						metrics.IsHealthy.Store(false)
						log.Printf("Failed to unmarshal feed data: %v", err)
						d.Ack(false)
						return
					}

					trimmedUrl := strings.TrimSpace(feedData.FeedUrl)
					feed, err := fp.ParseURL(trimmedUrl)
					if err != nil || feed == nil {
						metrics.ErrorCount.Add(1)
						metrics.IsHealthy.Store(false)
						log.Printf("Failed to fetch feed %s: %v", trimmedUrl, err)
						d.Ack(false)
						return
					}

					log.Printf("Fetched feed %s with %d items", feed.Title, len(feed.Items))
					feedItemsPublishedAfterLastFetchedAt := make([]*gofeed.Item, 0)
					feedHasNeverBeenFetched := feedData.LastFetchedAt == ""
					var feedLastFetchedAtParsed time.Time
					if !feedHasNeverBeenFetched {
						feedLastFetchedAtParsed, err = time.Parse(time.RFC3339, feedData.LastFetchedAt)
						failOnError(err, "Failed to parse last fetched at")
					}
					if len(feed.Items) == 0 {
						log.Printf("No items to process")
						d.Ack(false)
						return
					}
					for _, item := range feed.Items {
						publishedAt := getPublishedAt(item)
						if feedHasNeverBeenFetched || publishedAt.After(feedLastFetchedAtParsed) {
							feedItemsPublishedAfterLastFetchedAt = append(feedItemsPublishedAfterLastFetchedAt, item)
						}
					}

					savedPostsCount := 0
					for _, item := range feedItemsPublishedAfterLastFetchedAt {
						contentOrDescription := item.Content
						if contentOrDescription == "" {
							contentOrDescription = item.Description
						}
						post := Post{
							Title:       item.Title,
							Content:     contentOrDescription,
							URL:         item.Link,
							PublishedAt: getPublishedAt(item).Format(time.RFC3339),
							GUID:        item.GUID,
							BlogID:      feedData.ID,
						}

						postGuid, err := generatePostGUID(post)
						if err != nil {
							log.Printf("Failed to generate post GUID: %v", err)
							metrics.ErrorCount.Add(1)
							continue
						}

						exists, err := getPostByGuid(postGuid, post.BlogID)
						if err != nil {
							log.Printf("Error checking if post exists: %v", err)
							metrics.ErrorCount.Add(1)
							continue
						}

						if exists {
							log.Printf("Post with GUID %s already exists for blog %d", post.GUID, post.BlogID)
							continue
						}

						postID, err := createPost(post)
						if err != nil {
							log.Printf("Failed to create post: %v", err)
							metrics.ErrorCount.Add(1)
							continue
						}

						log.Printf("Created post with ID %d: %s", postID, post.Title)

						// Send the post data to the post_queue for WebSockets updates
						postJson, err := json.Marshal(post)
						failOnError(err, "Failed to marshal post data")
						err = ch.Publish(
							"",             // exchange
							postQueue.Name, // routing key
							false,          // mandatory
							false,          // immediate
							amqp.Publishing{
								DeliveryMode: amqp.Persistent,
								ContentType:  "text/plain",
								Body:         []byte(postJson),
							})
						failOnError(err, "Failed to publish a message")
						log.Printf(" [x] Sent %s", item.Title)
						savedPostsCount++
					}

					err = updateBlogStats(feedData.ID)
					if err != nil {
						log.Printf("Failed to update blog stats: %v", err)
						metrics.ErrorCount.Add(1)
					}

					metrics.ProcessedFeedsCount.Add(1)
					metrics.ProcessedPostsCount.Add(int64(len(feedItemsPublishedAfterLastFetchedAt)))
					metrics.LastSuccessfulRun.Store(time.Now())
					metrics.IsHealthy.Store(true)

					log.Printf("Processed feed %s: %d new posts found, %d posts saved",
						feed.Title,
						len(feedItemsPublishedAfterLastFetchedAt),
						savedPostsCount)

					d.Ack(false)
				}()
			}
		}()

		log.Printf("RabbitMQ connection open")

		err = <-connClose
		log.Printf("RabbitMQ connection closed: %v", err)
		metrics.IsHealthy.Store(false)
		ch.Close()
		conn.Close()
		time.Sleep(5 * time.Second)
		continue
	}
}
