package database

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var _ = godotenv.Load()
var dbUrl = os.Getenv("DATABASE_URL")
var db *sql.DB

type Blog struct {
	ID              int            `json:"id"`
	HashId          string         `json:"hash_id"`
	FeedUrl         string         `json:"feed_url"`
	SiteUrl         sql.NullString `json:"site_url"`
	AutoTitle       sql.NullString `json:"auto_title"`
	AutoDescription sql.NullString `json:"auto_description"`
	AutoImageUrl    sql.NullString `json:"auto_image_url"`
	AutoAuthor      sql.NullString `json:"auto_author"`
	LastFetchedAt   sql.NullString `json:"last_fetched_at"`
	LastPublishedAt sql.NullString `json:"last_published_at"`
	CreatedAt       string         `json:"created_at"`
	PostsLastMonth  sql.NullInt64  `json:"posts_last_month"`
	LastModifiedAt  sql.NullString `json:"last_modified_at"`
}

type Post struct {
	Title       string `json:"title"`
	Content     string `json:"content"`
	URL         string `json:"url"`
	PublishedAt string `json:"published_at"`
	GUID        string `json:"guid"`
	BlogID      int    `json:"blog_id"`
}

type DB struct {
	Conn *sql.DB
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

func InitDB() (*DB, error) {
	if db != nil {
		return &DB{Conn: db}, nil
	}

	var err error
	db, err = connectToDatabase(dbUrl)
	if err != nil {
		return nil, err
	}

	return &DB{Conn: db}, nil
}

func (db *DB) GetPostByGuid(guid string, blogId int) (bool, error) {
	var count int
	err := db.Conn.QueryRow("SELECT COUNT(*) FROM posts WHERE guid = $1 AND blog_id = $2", guid, blogId).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (db *DB) CreatePost(post Post) (int, error) {
	var id int
	publishedAt, err := time.Parse(time.RFC3339, post.PublishedAt)
	if err != nil {
		return 0, fmt.Errorf("invalid published_at date: %v", err)
	}

	// Insert the post
	err = db.Conn.QueryRow(`
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

func (db *DB) UpdateBlogLastFetchedAt(blogId int) error {
	_, err := db.Conn.Exec("UPDATE blogs SET last_fetched_at = $1 WHERE id = $2",
		time.Now().Format(time.RFC3339), blogId)
	return err
}

func (db *DB) UpdateBlogPostsLastMonth(blogId int) error {
	_, err := db.Conn.Exec(`
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

func (db *DB) UpdateBlogLastPublishedAt(blogId int) error {
	_, err := db.Conn.Exec(`
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

func (db *DB) UpdateBlogLastModifiedAt(blogId int, lastModifiedAt time.Time) error {
	_, err := db.Conn.Exec("UPDATE blogs SET last_modified_at = $1 WHERE id = $2",
		lastModifiedAt.Format(time.RFC3339), blogId)
	return err
}

func (db *DB) UpdateBlogStats(blogId int) error {
	err := db.UpdateBlogLastFetchedAt(blogId)
	if err != nil {
		return err
	}

	err = db.UpdateBlogPostsLastMonth(blogId)
	if err != nil {
		return err
	}

	err = db.UpdateBlogLastPublishedAt(blogId)
	if err != nil {
		return err
	}

	return nil
}

func (db *DB) GetBlogs() ([]Blog, error) {
	rows, err := db.Conn.Query(`
		SELECT id, hash_id, feed_url, site_url, auto_title, auto_description, auto_image_url, auto_author,
			last_fetched_at, last_published_at, created_at, posts_last_month, last_modified_at
		FROM blogs
		WHERE id IN (SELECT DISTINCT blog_id FROM list_blogs);
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var blogs []Blog
	for rows.Next() {
		var blog Blog
		err := rows.Scan(&blog.ID, &blog.HashId, &blog.FeedUrl, &blog.SiteUrl,
			&blog.AutoTitle, &blog.AutoDescription, &blog.AutoImageUrl,
			&blog.AutoAuthor, &blog.LastFetchedAt, &blog.LastPublishedAt,
			&blog.CreatedAt, &blog.PostsLastMonth, &blog.LastModifiedAt)
		if err != nil {
			return nil, err
		}
		blogs = append(blogs, blog)
	}

	return blogs, nil
}
