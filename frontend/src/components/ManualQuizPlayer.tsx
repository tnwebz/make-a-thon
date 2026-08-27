import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, Clock, Award, HelpCircle,
  ArrowRight, ArrowLeft, RotateCcw, AlertTriangle, Sparkles, Check, ChevronRight
} from 'lucide-react';

export interface QuizOptionData {
  id?: number;
  option_index: number;
  option_text: string;
  translated_option_text?: string | null;
}

export interface QuizQuestionData {
  id: number;
  order_index: number;
  question_text: string;
  translated_question_text?: string | null;
  options: QuizOptionData[];
  correct_option_index?: number; // Present in offline manifest or after submission
}

export interface QuizData {
  id?: number;
  title: string;
  description?: string;
  quiz_type?: string;
  duration_minutes?: number;
  is_mandatory?: boolean;
  total_questions?: number;
  questions: QuizQuestionData[];
}

interface ManualQuizPlayerProps {
  quiz: QuizData;
  language?: string; // 'en' | 'hi' | 'ta'
  isOffline?: boolean;
  onSubmitOnline?: (answers: Record<number, number>) => Promise<{
    score: number;
    total_questions: number;
    percentage: number;
    passed: boolean;
    question_results?: any[];
  }>;
  onCompleted?: (result: { score: number; percentage: number; passed: boolean }) => void;
}

export const ManualQuizPlayer: React.FC<ManualQuizPlayerProps> = ({
  quiz,
  language = 'en',
  isOffline = false,
  onSubmitOnline,
  onCompleted
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(
    quiz.duration_minutes ? quiz.duration_minutes * 60 : null
  );

  const questions = quiz.questions || [];
  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;
  const isBilingual = language === 'hi' || language === 'ta';
  const langLabel = language === 'hi' ? 'हिन्दी' : language === 'ta' ? 'தமிழ்' : '';

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || isSubmitted) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);

  const handleSelectOption = (questionId: number, optionIndex: number) => {
    if (isSubmitted) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitted || submitting) return;
    setSubmitting(true);

    try {
      if (!isOffline && onSubmitOnline) {
        // Online submission via backend API
        const result = await onSubmitOnline(selectedAnswers);
        setSubmissionResult(result);
        setIsSubmitted(true);
        if (onCompleted) {
          onCompleted({
            score: result.score,
            percentage: result.percentage,
            passed: result.passed
          });
        }
      } else {
        // Offline / Standalone evaluation in memory
        let score = 0;
        const qResults = questions.map(q => {
          const selected = selectedAnswers[q.id];
          const isCorrect = typeof q.correct_option_index === 'number' && selected === q.correct_option_index;
          if (isCorrect) score++;
          return {
            question_id: q.id,
            question_text: q.question_text,
            translated_question_text: q.translated_question_text,
            selected_option_index: selected,
            correct_option_index: q.correct_option_index,
            is_correct: isCorrect
          };
        });

        const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
        const passed = percentage >= 60;
        const result = {
          score,
          total_questions: totalQuestions,
          percentage,
          passed,
          question_results: qResults
        };

        setSubmissionResult(result);
        setIsSubmitted(true);
        if (onCompleted) {
          onCompleted({ score, percentage, passed });
        }
      }
    } catch (err) {
      console.error("Quiz submission error:", err);
      // Fallback to local evaluation if online call fails
      let score = 0;
      const qResults = questions.map(q => {
        const selected = selectedAnswers[q.id];
        const isCorrect = typeof q.correct_option_index === 'number' && selected === q.correct_option_index;
        if (isCorrect) score++;
        return {
          question_id: q.id,
          question_text: q.question_text,
          translated_question_text: q.translated_question_text,
          selected_option_index: selected,
          correct_option_index: q.correct_option_index,
          is_correct: isCorrect
        };
      });

      const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
      const passed = percentage >= 60;
      const result = {
        score,
        total_questions: totalQuestions,
        percentage,
        passed,
        question_results: qResults
      };
      setSubmissionResult(result);
      setIsSubmitted(true);
      if (onCompleted) {
        onCompleted({ score, percentage, passed });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setSubmissionResult(null);
    setCurrentIdx(0);
    setTimeLeft(quiz.duration_minutes ? quiz.duration_minutes * 60 : null);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-sm">
        <HelpCircle size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="text-lg font-bold text-slate-700">No questions available in this quiz</h3>
      </div>
    );
  }

  // POST-SUBMISSION RESULTS VIEW
  if (isSubmitted && submissionResult) {
    const isPassed = submissionResult.passed;
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Scorecard Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-8 sm:p-10 rounded-3xl border transition-all text-center relative overflow-hidden ${
            isPassed
              ? "bg-gradient-to-b from-emerald-50/80 to-white border-emerald-200 shadow-lg shadow-emerald-500/5"
              : "bg-gradient-to-b from-amber-50/80 to-white border-amber-200 shadow-lg shadow-amber-500/5"
          }`}
        >
          <div className="inline-flex p-4 rounded-3xl bg-white shadow-md mb-4">
            {isPassed ? (
              <Award size={48} className="text-emerald-500" />
            ) : (
              <AlertTriangle size={48} className="text-amber-500" />
            )}
          </div>

          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
            {isPassed ? "Assessment Passed!" : "Assessment Completed"}
          </h2>
          <p className="text-sm font-medium text-slate-500 mb-6 max-w-md mx-auto">
            {isPassed
              ? "Great job! You have demonstrated strong competency on these concepts."
              : "Good effort! Review the detailed answers below to reinforce your understanding."}
          </p>

          <div className="inline-flex items-center justify-center gap-6 bg-white px-8 py-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Score</div>
              <div className="text-2xl font-black text-slate-900">
                {submissionResult.score} / {submissionResult.total_questions}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Percentage</div>
              <div className={`text-2xl font-black ${isPassed ? 'text-emerald-600' : 'text-amber-600'}`}>
                {submissionResult.percentage}%
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</div>
              <div className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {isPassed ? 'Passed' : 'Needs Review'}
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={handleRetake}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm shadow-xs"
            >
              <RotateCcw size={16} /> Retake Assessment
            </button>
          </div>
        </motion.div>

        {/* Detailed Question Review List */}
        <div className="space-y-4">
          <h3 className="text-lg font-black text-slate-900 px-2 flex items-center gap-2">
            <span>Detailed Question Review</span>
            <span className="text-xs font-semibold text-slate-500">
              ({submissionResult.score} of {submissionResult.total_questions} correct)
            </span>
          </h3>

          {questions.map((q, idx) => {
            const selectedOptIdx = selectedAnswers[q.id];
            const correctOptIdx = typeof q.correct_option_index === 'number'
              ? q.correct_option_index
              : submissionResult.question_results?.find((r: any) => r.question_id === q.id)?.correct_option_index;
            const isCorrect = selectedOptIdx === correctOptIdx;

            return (
              <div
                key={q.id || idx}
                className={`p-6 rounded-3xl border transition-all ${
                  isCorrect
                    ? "bg-white border-emerald-200/80 shadow-xs"
                    : "bg-white border-red-200/80 shadow-xs"
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${
                    isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {isCorrect ? <Check size={16} /> : <XCircle size={16} />}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Question {idx + 1}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {isCorrect ? 'Correct (+1)' : 'Incorrect (0)'}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 leading-snug">
                      {q.question_text}
                    </h4>

                    {/* Bilingual secondary question translation */}
                    {isBilingual && q.translated_question_text && (
                      <p className="text-sm font-semibold text-slate-600 mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                          {langLabel}
                        </span>
                        {q.translated_question_text}
                      </p>
                    )}
                  </div>
                </div>

                {/* 4 Options Review */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {q.options.map(opt => {
                    const optLetter = String.fromCharCode(65 + opt.option_index);
                    const isSelected = selectedOptIdx === opt.option_index;
                    const isCorrectAnswer = correctOptIdx === opt.option_index;

                    let cardStyle = "border-slate-200 bg-slate-50/50 text-slate-700";
                    let badgeStyle = "bg-slate-200 text-slate-700";

                    if (isCorrectAnswer) {
                      cardStyle = "border-emerald-300 bg-emerald-50/80 text-emerald-950 font-bold ring-1 ring-emerald-400/20";
                      badgeStyle = "bg-emerald-600 text-white";
                    } else if (isSelected && !isCorrectAnswer) {
                      cardStyle = "border-red-300 bg-red-50/80 text-red-950 ring-1 ring-red-400/20";
                      badgeStyle = "bg-red-600 text-white";
                    }

                    return (
                      <div
                        key={opt.option_index}
                        className={`p-3 rounded-2xl border flex items-start gap-3 transition-all ${cardStyle}`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${badgeStyle}`}>
                          {optLetter}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm font-semibold leading-snug">
                            {opt.option_text}
                          </div>
                          {isBilingual && opt.translated_option_text && (
                            <div className="text-xs text-slate-500 font-medium mt-0.5">
                              {opt.translated_option_text}
                            </div>
                          )}
                        </div>
                        {isCorrectAnswer && (
                          <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                            Correct
                          </span>
                        )}
                        {isSelected && !isCorrectAnswer && (
                          <span className="text-[10px] font-black uppercase text-red-700 bg-red-100 px-1.5 py-0.5 rounded shrink-0">
                            Your Choice
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ACTIVE QUIZ INTERFACE
  const answeredCount = Object.keys(selectedAnswers).length;
  const progressPercent = (answeredCount / totalQuestions) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header bar with timer and question dots */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              Interactive Quiz
            </span>
            {isBilingual && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Sparkles size={11} /> Bilingual {langLabel}
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {quiz.title}
          </h2>
          {quiz.description && (
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {quiz.description}
            </p>
          )}
        </div>

        {/* Timer */}
        {timeLeft !== null && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border font-mono font-bold text-sm ${
            timeLeft < 120 
              ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
              : 'bg-slate-50 text-slate-700 border-slate-200'
          }`}>
            <Clock size={16} />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        )}
      </div>

      {/* Question Stepper & Progress */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {questions.map((q, idx) => {
            const isAnswered = selectedAnswers[q.id] !== undefined;
            const isCurrent = currentIdx === idx;

            return (
              <button
                key={q.id || idx}
                onClick={() => setCurrentIdx(idx)}
                className={`w-8 h-8 rounded-xl text-xs font-black transition-all flex items-center justify-center shrink-0 ${
                  isCurrent
                    ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                    : isAnswered
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                title={`Question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <div className="text-xs font-bold text-slate-500 shrink-0">
          <span className="text-slate-900 font-black">{answeredCount}</span> of {totalQuestions} answered
        </div>
      </div>

      {/* Active Question Card */}
      {currentQuestion && (
        <motion.div
          key={currentQuestion.id || currentIdx}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6"
        >
          {/* Question Text */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Question {currentIdx + 1} of {totalQuestions}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 leading-relaxed">
              {currentQuestion.question_text}
            </h3>

            {/* Bilingual Translation */}
            {isBilingual && currentQuestion.translated_question_text && (
              <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-sm font-semibold text-slate-700 flex items-start gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wider shrink-0 mt-0.5">
                  {langLabel}
                </span>
                <span className="leading-relaxed">{currentQuestion.translated_question_text}</span>
              </div>
            )}
          </div>

          {/* Options Grid */}
          <div className="space-y-3 pt-2">
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedAnswers[currentQuestion.id] === opt.option_index;
              const optLetter = String.fromCharCode(65 + opt.option_index);

              return (
                <button
                  key={opt.option_index}
                  type="button"
                  onClick={() => handleSelectOption(currentQuestion.id, opt.option_index)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                    isSelected
                      ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {optLetter}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                      {opt.option_text}
                    </div>

                    {isBilingual && opt.translated_option_text && (
                      <div className="text-xs sm:text-sm font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                        <span className="text-[9px] font-black px-1 rounded bg-slate-100 text-slate-600 uppercase">
                          {langLabel}
                        </span>
                        {opt.translated_option_text}
                      </div>
                    )}
                  </div>

                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer Navigation */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs sm:text-sm hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <ArrowLeft size={16} /> Previous
            </button>

            <div className="flex items-center gap-2">
              {currentIdx < totalQuestions - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIdx(prev => Math.min(totalQuestions - 1, prev + 1))}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  Next <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? "Evaluating Answers..." : "Submit Assessment"}
                  <CheckCircle2 size={16} />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
