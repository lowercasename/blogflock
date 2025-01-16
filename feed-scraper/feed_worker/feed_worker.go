package main

import (
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
)

type Feed struct {
	AutoDescription string `json:"autoDescription"`
	AutoImageUrl    string `json:"autoImageUrl"`
	AutoTitle       string `json:"autoTitle"`
	CreatedAt       string `json:"createdAt"`
	FeedUrl         string `json:"feedUrl"`
	HashId          string `json:"hashId"`
	ID              int    `json:"id"`
	LastFetchedAt   string `json:"lastFetchedAt"`
	SiteUrl         string `json:"siteUrl"`
}

type Post struct {
	Title       string `json:"title"`
	Content     string `json:"content"`
	URL         string `json:"url"`
	PublishedAt string `json:"publishedAt"`
	GUID        string `json:"guid"`
	BlogID      int    `json:"blogId"`
}

type AppMetrics struct {
	LastSuccessfulRun   atomic.Value
	ProcessedFeedsCount atomic.Int64
	ProcessedPostsCount atomic.Int64
	ErrorCount          atomic.Int64
	IsHealthy           atomic.Bool
	RabbitMQConnected   atomic.Bool
	LastConnectionTime  atomic.Value
}

var metrics AppMetrics

func init() {
	metrics.LastSuccessfulRun.Store(time.Time{})
	metrics.IsHealthy.Store(true)
}

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

func main() {
	err := godotenv.Load()
	failOnError(err, "Failed to load .env file")

	rabbitmqUser := os.Getenv("RABBITMQ_USER")
	rabbitmqPassword := os.Getenv("RABBITMQ_PASSWORD")
	rabbitmqHost := os.Getenv("RABBITMQ_HOST")

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

					feed, err := fp.ParseURL(feedData.FeedUrl)
					if err != nil || feed == nil {
						metrics.ErrorCount.Add(1)
						metrics.IsHealthy.Store(false)
						log.Printf("Failed to fetch feed %s: %v", feedData.FeedUrl, err)
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
						postJson, err := json.Marshal(post)
						failOnError(err, "Failed to marshal post data")
						// Send the post data to the post_queue
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
					}

					metrics.ProcessedFeedsCount.Add(1)
					metrics.ProcessedPostsCount.Add(int64(len(feedItemsPublishedAfterLastFetchedAt)))
					metrics.LastSuccessfulRun.Store(time.Now())
					metrics.IsHealthy.Store(true)

					log.Printf("Done")
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
		time.Sleep(5 * time.Second) // Wait before reconnecting
		continue
	}
}
