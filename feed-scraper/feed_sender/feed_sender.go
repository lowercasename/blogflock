package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/joho/godotenv"
	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/lowercasename/blogflock/feed-scraper/database"
)

type AppMetrics struct {
	LastSuccessfulRun atomic.Value
	IsHealthy         atomic.Bool
	DbConnected       atomic.Bool
}

var metrics AppMetrics

func init() {
	metrics.LastSuccessfulRun.Store(time.Time{})
	metrics.IsHealthy.Store(true)
}

func failOnError(err error, msg string) {
	if err != nil {
		metrics.IsHealthy.Store(false)
		log.Panicf("%s: %s", msg, err)
	}
}

func processFeedQueue(ctx context.Context, ch *amqp.Channel, feedQueue amqp.Queue) error {
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

	blogs, err := db.GetBlogs()
	if err != nil {
		log.Printf("Failed to get blogs: %v", err)
		metrics.IsHealthy.Store(false)
	}
	log.Printf("Fetched %d blogs", len(blogs))

	for _, blog := range blogs {
		feedJson, err := json.Marshal(blog)
		if err != nil {
			metrics.IsHealthy.Store(false)
			return err
		}

		feedHasNeverBeenFetched := !blog.LastFetchedAt.Valid || blog.LastFetchedAt.String == ""
		var timeLastFetched time.Time
		if !feedHasNeverBeenFetched {
			timeLastFetched, err = time.Parse(time.RFC3339, blog.LastFetchedAt.String)
			if err != nil {
				metrics.IsHealthy.Store(false)
				return err
			}
		}

		if feedHasNeverBeenFetched || time.Since(timeLastFetched) >= time.Minute*60 {
			err = ch.PublishWithContext(ctx,
				"",             // exchange
				feedQueue.Name, // routing key
				false,          // mandatory
				false,
				amqp.Publishing{
					DeliveryMode: amqp.Persistent,
					ContentType:  "text/plain",
					Body:         []byte(feedJson),
				})
			if err != nil {
				metrics.IsHealthy.Store(false)
				return err
			}
			log.Printf(" [x] Sent %s", blog.FeedUrl)
		} else {
			log.Printf(" [x] Skipping %s", blog.FeedUrl)
		}
	}

	metrics.LastSuccessfulRun.Store(time.Now())
	metrics.IsHealthy.Store(true)
	return nil
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	isHealthy := metrics.IsHealthy.Load()
	lastRun := metrics.LastSuccessfulRun.Load().(time.Time)

	if strings.Contains(r.Header.Get("Accept"), "application/openmetrics-text") {
		w.Header().Set("Content-Type", "application/openmetrics-text;version=1.0.0;charset=utf-8")

		fmt.Fprintf(w, "# HELP feed_sender_healthy Whether the feed sender is healthy\n")
		fmt.Fprintf(w, "# TYPE feed_sender_healthy gauge\n")
		if isHealthy {
			fmt.Fprintf(w, "feed_sender_healthy 1\n")
		} else {
			fmt.Fprintf(w, "feed_sender_healthy 0\n")
		}

		fmt.Fprintf(w, "# HELP feed_sender_last_successful_run_timestamp_seconds Unix timestamp of last successful run\n")
		fmt.Fprintf(w, "# TYPE feed_sender_last_successful_run_timestamp_seconds gauge\n")
		fmt.Fprintf(w, "feed_sender_last_successful_run_timestamp_seconds %d\n", lastRun.Unix())

		fmt.Fprintf(w, "# HELP feed_sender_db_connected Whether the feed sender is connected to the database\n")
		fmt.Fprintf(w, "# TYPE feed_sender_db_connected gauge\n")
		if metrics.DbConnected.Load() {
			fmt.Fprintf(w, "feed_sender_db_connected 1\n")
		} else {
			fmt.Fprintf(w, "feed_sender_db_connected 0\n")
		}

		fmt.Fprintf(w, "# EOF\n")
		return
	}

	status := struct {
		Status            string    `json:"status"`
		LastSuccessfulRun time.Time `json:"lastSuccessfulRun"`
		DbConnected       bool      `json:"dbConnected"`
	}{
		Status:            "healthy",
		LastSuccessfulRun: lastRun,
		DbConnected:       metrics.DbConnected.Load(),
	}

	if !isHealthy {
		status.Status = "unhealthy"
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

func main() {
	err := godotenv.Load()
	failOnError(err, "Failed to load .env file")

	rabbitmqUser := os.Getenv("RABBITMQ_USER")
	rabbitmqPassword := os.Getenv("RABBITMQ_PASSWORD")
	rabbitmqHost := os.Getenv("RABBITMQ_HOST")

	go func() {
		http.HandleFunc("/health", healthHandler)
		if err := http.ListenAndServe(":8080", nil); err != nil {
			log.Printf("Health check server error: %v", err)
		}
	}()

	runProcessor := func() {
		conn, err := amqp.Dial("amqp://" + rabbitmqUser + ":" + rabbitmqPassword + "@" + rabbitmqHost + ":5672/")
		if err != nil {
			log.Printf("Failed to connect to RabbitMQ: %s", err)
			metrics.IsHealthy.Store(false)
			return
		}
		defer conn.Close()

		ch, err := conn.Channel()
		if err != nil {
			log.Printf("Failed to open channel: %s", err)
			metrics.IsHealthy.Store(false)
			return
		}
		defer ch.Close()

		feedQueue, err := ch.QueueDeclare(
			"feed_queue", // name
			true,         // durable
			false,        // delete when unused
			false,        // exclusive
			false,        // no-wait
			nil,          // arguments
		)
		if err != nil {
			log.Printf("Failed to declare queue: %s", err)
			metrics.IsHealthy.Store(false)
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err = processFeedQueue(ctx, ch, feedQueue)
		if err != nil {
			log.Printf("Error processing feed queue: %s", err)
			metrics.IsHealthy.Store(false)
		}
	}

	runProcessor()

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		runProcessor()
	}
}
