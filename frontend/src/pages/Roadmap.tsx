import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchQuizProgress } from '../api/client'
import { useAcademyProgress } from '../hooks/useAcademyProgress'

function getSessionId(): string {
  let id = localStorage.getItem('options_game_session_id')
  if (!id) {
    id = Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
    localStorage.setItem('options_game_session_id', id)
  }
  return id
}

const SESSION_ID = getSessionId()

// ── Data ───────────────────────────────────────────────────────────────────────

const STAGES = [
  {
    id: 'foundation',
    title: 'Основы',
    subtitle: 'Уроки 1–6',
    icon: '📚',
    color: 'blue',
    lessons: [
      { id: 1, title: 'Что такое опцион?', subtitle: 'Аналогия с супермаркетом' },
      { id: 2, title: 'Коллы и путы', subtitle: 'Право купить vs. продать' },
      { id: 3, title: 'Ценообразование', subtitle: 'Интуиция и Black-Scholes' },
      { id: 4, title: 'Греки', subtitle: 'Δ, Γ, Θ, V — спидометры позиции' },
      { id: 5, title: 'Временной распад', subtitle: 'Лучший друг продавца' },
      { id: 6, title: 'Подразумеваемая волатильность', subtitle: 'IV, IV Rank, VRP' },
    ],
    practice: [
      { label: 'Симулятор P&L', path: '/simulator', icon: '📈', desc: 'Визуализируйте профиль прибыли любой позиции' },
      { label: 'Калькулятор греков', path: '/calculator', icon: '🔢', desc: 'Рассчитайте Greeks для реальных опционов' },
    ],
  },
  {
    id: 'strategies',
    title: 'Стратегии',
    subtitle: 'Уроки 7–13',
    icon: '⚡',
    color: 'purple',
    lessons: [
      { id: 7,  title: 'Торговые стратегии', subtitle: 'Обзор всех подходов' },
      { id: 8,  title: 'Отчётность и коллапс IV', subtitle: 'Событийная торговля' },
      { id: 9,  title: 'Покрытый Колл', subtitle: 'Доход с акций' },
      { id: 10, title: 'Обеспеченный Пут', subtitle: 'Купить со скидкой' },
      { id: 11, title: 'Кредитные Спреды', subtitle: 'Ограниченный риск' },
      { id: 12, title: 'Риск Назначения', subtitle: 'Когда могут исполнить' },
      { id: 13, title: 'Управление Позициями', subtitle: 'Правила выхода' },
    ],
    practice: [
      { label: 'Торговая Игра', path: '/game', icon: '🎮', desc: 'Торгуйте на исторических данных без риска' },
    ],
  },
  {
    id: 'trading',
    title: 'Реальная торговля',
    subtitle: 'Инструменты',
    icon: '🎯',
    color: 'green',
    lessons: [],
    practice: [
      { label: 'Сканер опционов', path: '/scanner', icon: '📡', desc: 'Находите лучшие сетапы по книге "Trading Volatility"' },
      { label: 'Трекер позиций', path: '/positions', icon: '📋', desc: 'Ведите журнал и отслеживайте P&L' },
    ],
  },
]

const colorMap: Record<string, { bg: string; border: string; text: string; badge: string; line: string }> = {
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   badge: 'bg-blue-600',   line: 'bg-blue-500/40' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', badge: 'bg-purple-600', line: 'bg-purple-500/40' },
  green:  { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  badge: 'bg-green-600',  line: 'bg-green-500/40' },
}

// ── Components ─────────────────────────────────────────────────────────────────

function LessonRow({
  lesson,
  completed,
  quizPassed,
  quizScore,
  isCurrent,
  onClick,
}: {
  lesson: { id: number; title: string; subtitle: string }
  completed: boolean
  quizPassed: boolean
  quizScore: number | null
  isCurrent: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all
        ${isCurrent ? 'bg-blue-600/15 border border-blue-500/40' : 'hover:bg-gray-800/60 border border-transparent'}
      `}
    >
      {/* Status icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold
        ${completed && quizPassed ? 'bg-green-500/20 text-green-400 border border-green-500/40'
          : completed ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
          : 'bg-gray-700/60 text-gray-500 border border-gray-600/40'}`}
      >
        {completed && quizPassed ? '✓' : completed ? '~' : lesson.id}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${isCurrent ? 'text-blue-300' : completed ? 'text-white' : 'text-gray-400'}`}>
          {lesson.title}
        </div>
        <div className="text-xs text-gray-600">{lesson.subtitle}</div>
      </div>

      {/* Quiz score badge */}
      {quizScore !== null && (
        <div className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0
          ${quizPassed ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {quizScore.toFixed(0)}%
        </div>
      )}
    </button>
  )
}

function StageCard({
  stage,
  completedLessons,
  quizProgress,
  currentLesson,
}: {
  stage: typeof STAGES[0]
  completedLessons: number[]
  quizProgress: Map<number, { best_score: number; passed: boolean }>
  currentLesson: number
}) {
  const navigate = useNavigate()
  const c = colorMap[stage.color]

  const totalLessons = stage.lessons.length
  const doneLessons = stage.lessons.filter(l => completedLessons.includes(l.id)).length
  const passedQuizzes = stage.lessons.filter(l => quizProgress.get(l.id)?.passed).length
  const stageComplete = totalLessons > 0 && doneLessons === totalLessons && passedQuizzes === totalLessons
  const stageProgress = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 100

  return (
    <div className={`border rounded-2xl p-5 space-y-4 ${c.bg} ${c.border}`}>
      {/* Stage header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{stage.icon}</span>
          <div>
            <div className={`text-lg font-bold ${c.text}`}>{stage.title}</div>
            <div className="text-xs text-gray-500">{stage.subtitle}</div>
          </div>
        </div>
        {stageComplete && (
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${c.badge} text-white`}>
            Завершён ✓
          </span>
        )}
        {!stageComplete && totalLessons > 0 && (
          <span className="text-xs text-gray-500">{doneLessons}/{totalLessons} уроков</span>
        )}
      </div>

      {/* Progress bar (for stages with lessons) */}
      {totalLessons > 0 && (
        <div className="h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${c.line}`}
            style={{ width: `${stageProgress}%` }}
          />
        </div>
      )}

      {/* Lessons */}
      {stage.lessons.length > 0 && (
        <div className="space-y-1">
          {stage.lessons.map(lesson => {
            const qp = quizProgress.get(lesson.id)
            return (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                completed={completedLessons.includes(lesson.id)}
                quizPassed={qp?.passed ?? false}
                quizScore={qp?.best_score ?? null}
                isCurrent={currentLesson === lesson.id}
                onClick={() => navigate(`/academy/${lesson.id}`)}
              />
            )
          })}
        </div>
      )}

      {/* Practice links */}
      {stage.practice.length > 0 && (
        <div className="space-y-2 pt-1">
          {stage.lessons.length > 0 && (
            <div className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Практика</div>
          )}
          {stage.practice.map(p => (
            <button
              key={p.path}
              onClick={() => navigate(p.path)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800/40 hover:bg-gray-700/60 border border-gray-700/40 hover:border-gray-600/60 transition-all text-left"
            >
              <span className="text-xl">{p.icon}</span>
              <div>
                <div className="text-sm text-white font-medium">{p.label}</div>
                <div className="text-xs text-gray-500">{p.desc}</div>
              </div>
              <span className="ml-auto text-gray-600 text-sm">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Roadmap() {
  const navigate = useNavigate()
  const { progress, isCompleted } = useAcademyProgress()
  const [quizData, setQuizData] = useState<Array<{ lesson_id: number; best_score: number; passed: boolean; attempts: number }>>([])

  useEffect(() => {
    fetchQuizProgress(SESSION_ID).then(setQuizData).catch(() => {})
  }, [])

  const quizMap = useMemo(
    () => new Map(quizData.map(q => [q.lesson_id, q])),
    [quizData],
  )

  const totalLessons = 13
  const completedCount = progress.completedLessons.length
  const passedQuizCount = quizData.filter(q => q.passed).length
  const overallPct = Math.round((completedCount / totalLessons) * 100)

  // Determine next recommended step
  const nextLesson = [1,2,3,4,5,6,7,8,9,10,11,12,13].find(id => !isCompleted(id)) ?? null
  const nextQuiz = [1,2,3,4,5,6,7,8,9,10,11,12,13].find(id => isCompleted(id) && !quizMap.get(id)?.passed) ?? null

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Путь обучения</h1>
        <p className="text-gray-400 mt-1 text-sm">
          От основ до уверенной торговли опционами по стратегиям из «Trading Volatility»
        </p>
      </div>

      {/* Overall progress */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-3xl font-bold text-white">{overallPct}%</div>
            <div className="text-sm text-gray-400 mt-0.5">общий прогресс</div>
          </div>
          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-white">{completedCount}/{totalLessons}</div>
              <div className="text-xs text-gray-500">уроков</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{passedQuizCount}/{totalLessons}</div>
              <div className="text-xs text-gray-500">тестов</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{quizData.reduce((s, q) => s + q.attempts, 0)}</div>
              <div className="text-xs text-gray-500">попыток</div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>

        {/* Next step CTA */}
        {(nextQuiz || nextLesson) && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-blue-400 font-semibold uppercase tracking-wide mb-1">Следующий шаг</div>
              {nextQuiz ? (
                <div className="text-sm text-white">
                  Пройдите тест по уроку {nextQuiz} — вы его прочли, но тест ещё не сдан
                </div>
              ) : (
                <div className="text-sm text-white">
                  Урок {nextLesson} — продолжайте обучение
                </div>
              )}
            </div>
            <button
              onClick={() => navigate(nextQuiz ? `/academy/${nextQuiz}` : `/academy/${nextLesson}`)}
              className="shrink-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
            >
              Перейти →
            </button>
          </div>
        )}

        {overallPct === 100 && passedQuizCount === totalLessons && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">🏆</div>
            <div className="text-green-400 font-bold">Курс завершён!</div>
            <div className="text-sm text-gray-400 mt-1">
              Вы прошли все уроки и тесты. Используйте Сканер и Трекер позиций для реальной торговли.
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 text-xs">✓</span> Урок + тест</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center text-yellow-400 text-xs">~</span> Урок без теста</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-gray-700/60 border border-gray-600/40 text-xs flex items-center justify-center text-gray-500">?</span> Не начат</span>
      </div>

      {/* Stages */}
      <div className="space-y-4">
        {STAGES.map(stage => (
          <StageCard
            key={stage.id}
            stage={stage}
            completedLessons={progress.completedLessons}
            quizProgress={quizMap}
            currentLesson={progress.lastVisitedLesson}
          />
        ))}
      </div>
    </div>
  )
}
