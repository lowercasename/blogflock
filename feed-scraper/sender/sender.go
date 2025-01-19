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

type AppMetrics struct {
	LastSuccessfulRun atomic.Value
	IsHealthy         atomic.Bool
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

func processFeedQueue(ctx context.Context, ch *amqp.Channel, feedQueue amqp.Queue, apiUrl string) error {
	client := http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(apiUrl + "/api/blogs?skipOrphans=true")
	if err != nil {
		metrics.IsHealthy.Store(false)
		return err
	}
	defer resp.Body.Close()

	var feeds []Feed
	err = json.NewDecoder(resp.Body).Decode(&feeds)
	if err != nil {
		metrics.IsHealthy.Store(false)
		return err
	}

	log.Printf("Fetched %d feeds", len(feeds))

	for _, feed := range feeds {
		feedJson, err := json.Marshal(feed)
		if err != nil {
			metrics.IsHealthy.Store(false)
			return err
		}

		feedHasNeverBeenFetched := feed.LastFetchedAt == ""
		var timeLastFetched time.Time
		if !feedHasNeverBeenFetched {
			timeLastFetched, err = time.Parse(time.RFC3339, feed.LastFetchedAt)
			if err != nil {
				metrics.IsHealthy.Store(false)
				return err
			}
		}

		if feedHasNeverBeenFetched || time.Since(timeLastFetched) > time.Minute*15 {
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
			log.Printf(" [x] Sent %s", feed.FeedUrl)
		} else {
			log.Printf(" [x] Skipping %s", feed.FeedUrl)
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
		fmt.Fprintf(w, "# EOF\n")
		return
	}

	status := struct {
		Status            string    `json:"status"`
		LastSuccessfulRun time.Time `json:"lastSuccessfulRun"`
	}{
		Status:            "healthy",
		LastSuccessfulRun: lastRun,
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
	apiUrl := os.Getenv("API_URL")

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

		err = processFeedQueue(ctx, ch, feedQueue, apiUrl)
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
