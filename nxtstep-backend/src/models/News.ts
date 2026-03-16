// ============================================================
// NxtStep — NewsArticle & NewsEvent Models
// ============================================================

import mongoose, { Document, Schema } from 'mongoose';

export type NewsCategory = 'tech' | 'business' | 'finance' | 'ai' | 'startups';
export type NewsAction = 'click' | 'save' | 'share' | 'dismiss';

export interface INewsArticle extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  category: NewsCategory;
  summary: string;
  tags: string[];
  imageUrl?: string;
  globalClickCount: number;
  createdAt: Date;
}

const newsArticleSchema = new Schema<INewsArticle>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true, unique: true, index: true },
    source: { type: String, required: true },
    publishedAt: { type: Date, required: true, index: true },
    category: { type: String, enum: ['tech', 'business', 'finance', 'ai', 'startups'], required: true, index: true },
    summary: { type: String, default: '' },
    tags: { type: [String], default: [] },
    imageUrl: { type: String },
    globalClickCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

newsArticleSchema.index({ publishedAt: -1, category: 1 });
newsArticleSchema.index({ globalClickCount: -1 });
newsArticleSchema.index({ tags: 1 });

export const NewsArticle = mongoose.model<INewsArticle>('NewsArticle', newsArticleSchema);

// ─── NewsEvent ────────────────────────────────────────────────

export interface INewsEvent extends Document {
  userId: mongoose.Types.ObjectId;
  articleId: mongoose.Types.ObjectId;
  action: NewsAction;
  timestamp: Date;
}

const newsEventSchema = new Schema<INewsEvent>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  articleId: { type: Schema.Types.ObjectId, ref: 'NewsArticle', required: true, index: true },
  action: { type: String, enum: ['click', 'save', 'share', 'dismiss'], required: true },
  timestamp: { type: Date, default: Date.now, },
});

newsEventSchema.index({ userId: 1, timestamp: -1 });
newsEventSchema.index({ articleId: 1, action: 1 });
newsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90-day TTL

export const NewsEvent = mongoose.model<INewsEvent>('NewsEvent', newsEventSchema);
