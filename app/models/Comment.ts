import { Post } from "./Post.ts";
import { User } from "./User.ts";

export interface Comment {
  id: number;
  postId: number;
  userId: number;
  content: string;
  createdAt: string;
  parentCommentId: number | null;
  // Virtual fields for populated relations
  post?: Post;
  user?: User;
  parentComment?: Comment;
  replies?: Comment[];
}

export type CreateComment = Omit<Comment, "id" | "createdAt">;

export interface ThreadedComment extends Comment {
  user: User;
  replies: ThreadedComment[];
  depth: number;
}
