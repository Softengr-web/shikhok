import { bn } from './components';
import type { ExamQuestionReview } from './models';

export function ExamAnswerReview({ review }: { review: ExamQuestionReview[] }) {
  if (!review.length) return null;

  return <section className="exam-review" aria-labelledby="exam-review-title">
    <header className="exam-review-heading">
      <div><p className="eyebrow">শেখার পরের ধাপ</p><h2 id="exam-review-title">উত্তরভিত্তিক পর্যালোচনা</h2></div>
      <p>প্রতিটি প্রশ্নে আপনার উত্তর, সঠিক উত্তর ও সংক্ষিপ্ত ব্যাখ্যা দেখুন।</p>
    </header>
    <div className="exam-review-list">
      {review.map((item, index) => <article className={`exam-review-question${item.isCorrect ? ' is-correct' : ' is-incorrect'}`} key={item.questionId}>
        <div className="exam-review-question-head"><span>প্রশ্ন {bn(index + 1)}</span><strong>{item.isCorrect ? '✓ সঠিক' : '× ভুল'}</strong></div>
        <h3>{item.text}</h3>
        <div className="exam-review-options">
          {item.options.map((option, optionIndex) => {
            const correct = optionIndex === item.correctAnswer;
            const selected = optionIndex === item.selectedAnswer;
            return <div className={`exam-review-option${correct ? ' is-answer' : ''}${selected && !correct ? ' is-selected-wrong' : ''}`} key={`${item.questionId}-${optionIndex}`}>
              <span className="exam-review-option-letter">{String.fromCharCode(65 + optionIndex)}</span>
              <span>{option}</span>
              {correct && <b>{selected ? 'আপনার উত্তর · সঠিক' : 'সঠিক উত্তর'}</b>}
              {selected && !correct && <b>আপনার উত্তর</b>}
            </div>;
          })}
        </div>
        {item.explanation && <p className="exam-review-explanation"><b>ব্যাখ্যা</b><span>{item.explanation}</span></p>}
      </article>)}
    </div>
  </section>;
}
