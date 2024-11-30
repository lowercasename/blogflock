package main

import (
	"encoding/json"
	"log"
	"os"
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

	fp := gofeed.NewParser()

	// client := http.Client{
	// 	Timeout: 5 * time.Second,
	// }

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

	postQueue, err := ch.QueueDeclare(
		"post_queue", // name
		true,         // durable
		false,        // delete when unused
		false,        // exclusive
		false,        // no-wait
		nil,          // arguments
	)
	failOnError(err, "Failed to declare a queue")

	err = ch.Qos(
		1,     // prefetch count
		0,     // prefetch size
		false, // global
	)
	failOnError(err, "Failed to set QoS")

	feedQueueMessages, err := ch.Consume(
		feedQueue.Name, // queue
		"",             // consumer
		false,          // auto-ack
		false,          // exclusive
		false,          // no-local
		false,          // no-wait
		nil,            // args
	)
	failOnError(err, "Failed to register a consumer")

	var forever = make(chan struct{})

	go func() {
		for d := range feedQueueMessages {
			log.Printf("Received a message: %s", d.Body)
			// Unmarshal the feed data
			var feedData Feed
			err := json.Unmarshal(d.Body, &feedData)
			failOnError(err, "Failed to unmarshal feed data")
			feed, err := fp.ParseURL(feedData.FeedUrl)
			if err != nil {
				log.Printf("Failed to fetch feed %s", feedData.FeedUrl)
				d.Ack(false)
				continue
			}
			if feed == nil {
				log.Printf("Failed to fetch feed %s", feedData.FeedUrl)
				d.Ack(false)
				continue
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
				continue
			}
			for _, item := range feed.Items {
				if feedHasNeverBeenFetched || item.PublishedParsed.After(feedLastFetchedAtParsed) {
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
					PublishedAt: item.PublishedParsed.String(),
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
				// req, err := http.NewRequest("POST", "http://localhost:8021/api/posts", bytes.NewBuffer(postJson))
				// failOnError(err, "Failed to create request")
				// req.Header.Set("Content-Type", "application/json")
				// req.Header.Set("Authorization", "Bearer "+os.Getenv("API_TOKEN"))
				// resp, err := client.Do(req)
				// failOnError(err, "Failed to create post")
				// log.Printf(" [x] Created post for %s", item.Title)
				// resp.Body.Close()
			}
			log.Printf("Done")
			d.Ack(false)
		}
	}()

	log.Printf(" [*] Waiting for messages. To exit press CTRL+C")
	<-forever
}
