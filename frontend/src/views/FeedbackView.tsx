import React, { useState, useEffect } from 'react';
import {
  Star,
  MessageSquare,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const FeedbackView: React.FC = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalReviews: 0,
    averageRating: 0,
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Submit Modal
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest('/feedback');
      setReviews(data.reviews || []);
      setStats(data.statistics || stats);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      await apiRequest('/feedback', {
        method: 'POST',
        body: JSON.stringify({ rating, reviewText: reviewText.trim() }),
      });
      setShowSubmitModal(false);
      setReviewText('');
      setRating(5);
      setActionSuccess('Thank you! Your feedback has been published.');
      fetchFeedback();
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFeedback = async (feedbackId: number) => {
    try {
      await apiRequest(`/feedback/${feedbackId}`, { method: 'DELETE' });
      fetchFeedback();
    } catch (err: any) {
      setError(err.message || 'Failed to delete feedback.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary-600" />
            <span>Shuttle Service Reviews & Feedback</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Student and faculty ratings on punctuality, safety, and campus connectivity
          </p>
        </div>

        {user && user.verificationStatus === 'VERIFIED' && (
          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Write a Review</span>
          </button>
        )}
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate Satisfaction Rating Card */}
      <div className="p-6 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="text-center md:text-left space-y-1">
          <span className="text-xs font-mono uppercase text-neutral-400 tracking-wider">
            Overall Rating
          </span>
          <div className="flex items-center justify-center md:justify-start gap-3">
            <span className="text-4xl font-extrabold text-neutral-900 dark:text-neutral-100">
              {stats.averageRating > 0 ? stats.averageRating : '—'}
            </span>
            <div>
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(stats.averageRating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-neutral-300 dark:text-neutral-700'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-neutral-500">
                {stats.totalReviews} verified passenger reviews
              </span>
            </div>
          </div>
        </div>

        {/* Rating Bars Breakdown */}
        <div className="md:col-span-2 space-y-1.5 text-xs">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = stats.ratingBreakdown[star] || 0;
            const pct = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                <span className="w-8 font-mono text-[11px]">{star} ★</span>
                <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-right font-mono text-[11px] text-neutral-400">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          <p className="text-xs text-neutral-500">Loading verified reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 space-y-3">
          <MessageSquare className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto" />
          <h3 className="font-bold text-sm text-neutral-800 dark:text-neutral-200">
            No Feedback Published Yet
          </h3>
          <p className="text-xs max-w-sm mx-auto">
            Zero fake reviews are generated. Verified students and faculty can submit the first review of campus shuttle services.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div
              key={r.feedback_id}
              className="p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-bold flex items-center justify-center text-xs">
                    {r.author_name ? r.author_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 block">
                      {r.author_name}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {r.author_role} • {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300 dark:text-neutral-700'
                        }`}
                      />
                    ))}
                  </div>

                  {(user?.userId === r.user_id || user?.role === 'MANAGER') && (
                    <button
                      onClick={() => handleDeleteFeedback(r.feedback_id)}
                      className="p-1 rounded text-neutral-400 hover:text-rose-600 transition-colors"
                      title="Delete review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed text-xs">
                {r.review_text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Submit Review Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
              Submit Shuttle Feedback
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Share your feedback regarding bus punctuality, seat comfort, and driver courtesy.
            </p>

            <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Rating
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1 text-amber-400 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          s <= rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300 dark:text-neutral-700'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-neutral-600 dark:text-neutral-400 font-mono ml-2">
                    {rating} / 5 Stars
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700 dark:text-neutral-300 block">
                  Your Comments
                </label>
                <textarea
                  required
                  rows={4}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="e.g. The 7:45 AM Vaishali Nagar shuttle was on time and clean. Very comfortable commute..."
                  className="w-full p-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reviewText.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Publish Review</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
