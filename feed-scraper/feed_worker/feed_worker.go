package main

import (
	"crypto/sha256"
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
	"github.com/mmcdole/gofeed"
	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/lowercasename/blogflock/feed-scraper/database"
)

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

func generatePostGUID(post database.Post) (string, error) {
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

func parseLastModifiedHeader(lastModified string) (time.Time, error) {
	// Try standard RFC1123 format first (zero-padded days)
	t, err := time.Parse(time.RFC1123, lastModified)
	if err == nil {
		return t, nil
	}

	// If that fails, try non-zero-padded days
	const customTimeFormat = "Mon, 2 Jan 2006 15:04:05 GMT"
	t, err = time.Parse(customTimeFormat, lastModified)
	if err == nil {
		return t, nil
	}

	return time.Time{}, fmt.Errorf("failed to parse time: %v", err)
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

	var dbErr error
	db, dbErr := database.InitDB()
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
					var feedData database.Blog
					err := json.Unmarshal(d.Body, &feedData)
					if err != nil {
						metrics.ErrorCount.Add(1)
						metrics.IsHealthy.Store(false)
						log.Printf("Failed to unmarshal feed data: %v", err)
						d.Ack(false)
						return
					}

					trimmedUrl := strings.TrimSpace(feedData.FeedUrl)

					// Set up the HTTP request
					req, err := http.NewRequest("GET", trimmedUrl, nil)
					if err != nil {
						metrics.ErrorCount.Add(1)
						metrics.IsHealthy.Store(false)
						log.Printf("Failed to create request for feed %s: %v", trimmedUrl, err)
						d.Ack(false)
						return
					}
					req.Header.Set("User-Agent", "BlogFlock/1.0")
					if feedData.LastModifiedAt.Valid && feedData.LastModifiedAt.String != "" {
						lastModifiedAt, err := time.Parse(time.RFC3339, feedData.LastModifiedAt.String)
						if err != nil {
							metrics.ErrorCount.Add(1)
							metrics.IsHealthy.Store(false)
							log.Printf("Failed to parse last modified date: %v", err)
							d.Ack(false)
							return
						}
						req.Header.Set("If-Modified-Since", lastModifiedAt.Format(time.RFC1123))
					}
					client := &http.Client{
						Timeout: 10 * time.Second,
					}

					// Fetch the feed
					resp, err := client.Do(req)
					if err != nil {
						metrics.ErrorCount.Add(1)
						metrics.IsHealthy.Store(false)
						log.Printf("Failed to fetch feed %s: %v", trimmedUrl, err)
						d.Ack(false)
						return
					}
					defer resp.Body.Close()
					if resp.StatusCode == http.StatusNotModified {
						// In response to our If-Modified-Since header, the server
						// has indicated that the feed has not changed since the last fetch.
						log.Printf("Feed %s has not changed since last fetch", trimmedUrl)
						d.Ack(false)
						return
					} else if resp.StatusCode != http.StatusOK {
						metrics.ErrorCount.Add(1)
						metrics.IsHealthy.Store(false)
						log.Printf("Failed to fetch feed %s: %s", trimmedUrl, resp.Status)
						d.Ack(false)
						return
					}

					// Parse the feed
					feed, err := fp.Parse(resp.Body)
					if err != nil || feed == nil {
						metrics.ErrorCount.Add(1)
						metrics.IsHealthy.Store(false)
						log.Printf("Failed to fetch feed %s: %v", trimmedUrl, err)
						d.Ack(false)
						return
					}

					log.Printf("Fetched feed %s with %d items", feed.Title, len(feed.Items))

					// Update the feed last modified time if we received the header
					if resp.Header.Get("Last-Modified") != "" {
						lastModifiedAt, err := parseLastModifiedHeader(resp.Header.Get("Last-Modified"))
						if err != nil {
							log.Printf("Failed to parse last modified date: %v", err)
						} else {
							db.UpdateBlogLastModifiedAt(feedData.ID, lastModifiedAt)
						}
					}

					feedItemsPublishedAfterLastFetchedAt := make([]*gofeed.Item, 0)
					feedHasNeverBeenFetched := !feedData.LastFetchedAt.Valid || feedData.LastFetchedAt.String == ""
					var feedLastFetchedAtParsed time.Time
					if !feedHasNeverBeenFetched {
						feedLastFetchedAtParsed, err = time.Parse(time.RFC3339, feedData.LastFetchedAt.String)
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
						post := database.Post{
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

						exists, err := db.GetPostByGuid(postGuid, post.BlogID)
						if err != nil {
							log.Printf("Error checking if post exists: %v", err)
							metrics.ErrorCount.Add(1)
							continue
						}

						if exists {
							log.Printf("Post with GUID %s already exists for blog %d", post.GUID, post.BlogID)
							continue
						}

						postID, err := db.CreatePost(post)
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

					err = db.UpdateBlogStats(feedData.ID)
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
