import { useState } from 'react'
import clsx from 'clsx'
import { QuizQuestion as QuizQuestionType, QuizResultItem } from '../../hooks/useQuiz'

interface QuizQuestionProps {
  question: QuizQuestionType
  selectedAnswer: number | string | undefined
  onAnswer: (answer: number | string) => void
  result?: QuizResultItem
  questionNumber: number
  totalQuestions: number
}

export function QuizQuestion({
  question, selectedAnswer, onAnswer, result, questionNumber, totalQuestions,
}: QuizQuestionProps) {
  const [estimateInput, setEstimateInput] = useState('')
  const showResult = !!result

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-xs text-gray-400">Вопрос {questionNumber} из {totalQuestions}</div>
        <div className="flex-1 bg-gray-700 rounded-full h-1.5">
          <div className="bg-blue-500 h-1.5 rounded-full transition-all"
            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }} />
        </div>
      </div>

      <h3 className="text-sm font-medium text-white leading-relaxed">{question.question}</h3>

      {question.type === 'mcq' && question.options && (
        <div className="space-y-2">
          {question.options.map((option, i) => {
            const isSelected = selectedAnswer === i
            let cls = 'bg-gray-800 hover:bg-gray-700 border-gray-700'
            if (showResult && result) {
              if (i === Number(result.correct_answer)) cls = 'bg-green-900/40 border-green-600'
              else if (isSelected) cls = 'bg-red-900/40 border-red-600'
              else cls = 'bg-gray-800 border-gray-700 opacity-50'
            } else if (isSelected) {
              cls = 'bg-blue-900/40 border-blue-500'
            }
            return (
              <button key={i} onClick={() => !showResult && onAnswer(i)} disabled={showResult}
                className={clsx('w-full text-left p-3 rounded-xl border transition-all text-sm', cls,
                  showResult ? 'cursor-default' : 'cursor-pointer')}>
                <span className="font-semibold text-gray-400 mr-2">{String.fromCharCode(65 + i)}.</span>
                <span className="text-gray-200">{option}</span>
                {showResult && i === Number(result.correct_answer) && (
                  <span className="ml-2 text-green-400 text-xs font-semibold">✓</span>
                )}
                {showResult && isSelected && i !== Number(result.correct_answer) && (
                  <span className="ml-2 text-red-400 text-xs font-semibold">✗</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {question.type === 'estimate' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input type="number" step="0.01" value={estimateInput}
              onChange={e => setEstimateInput(e.target.value)}
              disabled={showResult}
              placeholder="Введите число"
              className="input w-36 font-mono text-center disabled:opacity-60" />
            {question.unit && <span className="text-gray-400 text-sm">{question.unit}</span>}
            {!showResult && (
              <button onClick={() => estimateInput !== '' && onAnswer(parseFloat(estimateInput))}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors">
                Ответить
              </button>
            )}
          </div>
          {showResult && (
            <div className={clsx('p-3 rounded-xl text-sm',
              result.correct
                ? 'bg-green-900/30 border border-green-700/40 text-green-300'
                : 'bg-red-900/30 border border-red-700/40 text-red-300')}>
              {result.correct ? '✓ Верно!' : `✗ Правильный ответ: ${result.correct_answer}`}
            </div>
          )}
        </div>
      )}

      {showResult && result && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-3 space-y-3">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">Объяснение</div>
            <p className="text-sm text-gray-200 leading-relaxed">{result.explanation}</p>
          </div>
          {result.formula_steps && result.formula_steps.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">Разбор по шагам</div>
              <ol className="space-y-1">
                {result.formula_steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-800/50 text-purple-300 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="text-gray-300 font-mono text-xs leading-relaxed pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
