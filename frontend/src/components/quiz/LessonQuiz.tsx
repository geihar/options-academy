import { useEffect, useState } from 'react'
import { useQuiz } from '../../hooks/useQuiz'
import { QuizQuestion } from './QuizQuestion'
import { QuizResult } from './QuizResult'

interface LessonQuizProps {
  lessonId: number
  userSessionId: string
}

export function LessonQuiz({ lessonId, userSessionId }: LessonQuizProps) {
  const [expanded, setExpanded] = useState(false)
  const { state, loadQuiz, setAnswer, nextQuestion, submitQuiz, reset } = useQuiz(lessonId, userSessionId)

  useEffect(() => {
    if (expanded && state.questions.length === 0 && !state.loading && !state.error) {
      loadQuiz()
    }
  }, [expanded]) // eslint-disable-line

  const currentQ = state.questions[state.currentIndex]
  const currentResult = state.submitted
    ? state.results.find(r => r.question_id === currentQ?.id)
    : undefined

  const isLastQuestion = state.currentIndex === state.questions.length - 1
  const currentAnswered = currentQ ? state.answers[currentQ.id] !== undefined : false

  const handleAnswer = (answer: number | string) => {
    if (!currentQ) return
    setAnswer(currentQ.id, answer)
  }

  const handleNext = () => {
    if (isLastQuestion) {
      submitQuiz(state.answers)
    } else {
      nextQuestion()
    }
  }

  if (!expanded) {
    return (
      <div className="mt-6 border border-blue-700/30 rounded-2xl overflow-hidden">
        <button onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between p-4 bg-blue-900/20 hover:bg-blue-900/30 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-xl">🧠</span>
            <div className="text-left">
              <div className="font-semibold text-white text-sm">Проверочный тест</div>
              <div className="text-xs text-gray-400">Закрепите материал урока</div>
            </div>
          </div>
          <span className="text-blue-400 text-xl">›</span>
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6 border border-blue-700/30 rounded-2xl overflow-hidden">
      <div className="p-4 bg-blue-900/20 border-b border-blue-700/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <span className="font-semibold text-white text-sm">Проверочный тест — Урок {lessonId}</span>
        </div>
        <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
      </div>

      <div className="p-5">
        {state.loading && (
          <div className="text-center py-6 text-gray-400 text-sm">
            <svg className="animate-spin h-5 w-5 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Загрузка...
          </div>
        )}

        {state.error && (
          <div className="text-red-400 text-sm text-center py-4">{state.error}</div>
        )}

        {!state.loading && !state.error && !state.submitted && currentQ && (
          <div className="space-y-4">
            <QuizQuestion
              question={currentQ}
              selectedAnswer={state.answers[currentQ.id]}
              onAnswer={handleAnswer}
              result={undefined}
              questionNumber={state.currentIndex + 1}
              totalQuestions={state.questions.length}
            />
            <button
              onClick={handleNext}
              disabled={!currentAnswered}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-colors font-medium text-sm">
              {isLastQuestion ? 'Завершить тест' : 'Следующий вопрос →'}
            </button>
          </div>
        )}

        {state.submitted && (
          <QuizResult
            score={state.score}
            total={state.total}
            passed={state.passed}
            results={state.results}
            onRetry={reset}
          />
        )}
      </div>
    </div>
  )
}
