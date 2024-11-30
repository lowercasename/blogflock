package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
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

func failOnError(err error, msg string) {
	if err != nil {
		log.Panicf("%s: %s", msg, err)
	}
}

func main() {
	err := godotenv.Load()
	failOnError(err, "Failed to load .env file")
	rabbitmqUser := os.Getenv("RABBITMQ_USER")
	rabbitmqPassword := os.Getenv("RABBITMQ_PASSWORD")
	rabbitmqHost := os.Getenv("RABBITMQ_HOST")
	apiUrl := os.Getenv("API_URL")

	conn, err := amqp.Dial("amqp://" + rabbitmqUser + ":" + rabbitmqPassword + "@" + rabbitmqHost + ":5672/")
	failOnError(err, "Failed to connect to RabbitMQ")
	defer conn.Close()

	ch, err := conn.Channel()
	failOnError(err, "Failed to open a channel")
	defer ch.Close()

	feedQueue, err := ch.QueueDeclare(
		"feed_queue", // name
		true,         // durable
		false,        // delete when unused
		false,        // exclusive
		false,        // no-wait
		nil,          // arguments
	)
	failOnError(err, "Failed to declare a queue")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Fetch feed data from REST API
	client := http.Client{
		Timeout: 5 * time.Second,
	}
	resp, err := client.Get(apiUrl + "/api/blogs")
	failOnError(err, "Failed to fetch feed data")
	defer resp.Body.Close()

	var feeds []Feed
	err = json.NewDecoder(resp.Body).Decode(&feeds)
	failOnError(err, "Failed to decode feed data")
	log.Printf("Fetched %d feeds", len(feeds))

	for _, feed := range feeds {
		feedJson, err := json.Marshal(feed)
		failOnError(err, "Failed to marshal feed data")
		// If the blog was last fetched more than 15 minutes ago, fetch it again
		feedHasNeverBeenFetched := feed.LastFetchedAt == ""
		var timeLastFetched time.Time
		if !feedHasNeverBeenFetched {
			timeLastFetched, err = time.Parse(time.RFC3339, feed.LastFetchedAt)
			failOnError(err, "Failed to parse last fetched time")
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
			failOnError(err, "Failed to publish a message")
			log.Printf(" [x] Sent %s", feed.FeedUrl)
		} else {
			log.Printf(" [x] Skipping %s", feed.FeedUrl)
		}
	}
}
