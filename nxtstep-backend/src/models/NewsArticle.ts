import mongoose, { Document, Schema } from 'mongoose';

export type NewsCategory = 'tech' | 'business' | 'finance' | 'ai' | 'startups';

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
    category: {
      type: String,
      enum: ['tech', 'business', 'finance', 'ai', 'startups'],
      required: true,
      index: true,
    },
    summary: { type: String, default: '' },
    tags: { type: [String], default: [], index: true },
    imageUrl: { type: String },
    globalClickCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

newsArticleSchema.index({ publishedAt: -1, category: 1 });

export const NewsArticle = mongoose.model<INewsArticle>('NewsArticle', newsArticleSchema);