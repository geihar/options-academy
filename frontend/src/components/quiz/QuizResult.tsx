import clsx from 'clsx'
import { QuizResultItem } from '../../hooks/useQuiz'

interface QuizResultProps {
  score: number
  total: number
  passed: boolean
  results: QuizResultItem[]
  onRetry: () => void
}

export function QuizResult({ score, total, passed, results, onRetry }: QuizResultProps) {
  const percentage = Math.round((score / total) * 100)
  const wrong = results.filter(r => !r.correct)

  return (
    <div className="space-y-4">
      <div className={clsx('text-center p-5 rounded-2xl border-2',
        passed ? 'bg-green-900/20 border-green-600/40' : 'bg-orange-900/20 border-orange-600/40')}>
        <div className="text-4xl mb-2">{passed ? '🏆' : '📚'}</div>
        <div className="text-3xl font-bold text-white mb-1">{score} / {total}</div>
        <div className={clsx('text-xl font-semibold', passed ? 'text-green-400' : 'text-orange-400')}>
          {percentage}% — {passed ? 'Зачёт!' : 'Попробуйте ещё раз'}
        </div>
        {!passed && <div className="text-sm text-gray-400 mt-1">Для зачёта нужно 60%</div>}
      </div>

      <div className="flex gap-1.5 justify-center">
        {results.map((r, i) => (
          <div key={i} title={r.correct ? 'Верно' : 'Неверно'}
            className={clsx('h-5 w-5 rounded', r.correct ? 'bg-green-500' : 'bg-red-500')} />
        ))}
      </div>

      {wrong.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-300">Разбор ошибок:</div>
          {wrong.map((r, i) => (
            <div key={i} className="bg-red-900/20 border border-red-700/30 rounded-xl p-3 text-sm space-y-2">
              <div className="text-red-300 font-semibold">Правильный ответ: {r.correct_answer}</div>
              <div className="text-gray-300">{r.explanation}</div>
              {r.formula_steps && r.formula_steps.length > 0 && (
                <div className="border-t border-red-800/30 pt-2">
                  <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1.5">Как решать:</div>
                  <ol className="space-y-1">
                    {r.formula_steps.map((step, si) => (
                      <li key={si} className="flex gap-2">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-purple-800/50 text-purple-300 text-xs flex items-center justify-center font-bold">{si + 1}</span>
                        <span className="text-gray-400 font-mono text-xs leading-relaxed pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button onClick={onRetry}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors">
        {passed ? 'Пройти ещё раз' : 'Повторить тест'}
      </button>
    </div>
  )
}
