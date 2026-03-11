import mongoose, { Document, Schema } from 'mongoose';

export type NewsAction = 'click' | 'save' | 'share' | 'dismiss';

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
  timestamp: { type: Date, default: Date.now, index: true },
});

newsEventSchema.index({ userId: 1, timestamp: -1 });
newsEventSchema.index({ articleId: 1, action: 1 });

export const NewsEvent = mongoose.model<INewsEvent>('NewsEvent', newsEventSchema);