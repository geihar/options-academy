import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAcademyProgress } from '../hooks/useAcademyProgress'
import { ProgressBar } from '../components/ui/ProgressBar'
import { LessonQuiz } from '../components/quiz/LessonQuiz'
import Lesson01 from '../lessons/Lesson01_WhatIsAnOption'
import Lesson02 from '../lessons/Lesson02_CallsAndPuts'
import Lesson03 from '../lessons/Lesson03_PricingIntuition'
import Lesson04 from '../lessons/Lesson04_Greeks'
import Lesson05 from '../lessons/Lesson05_TimeDecay'
import Lesson06 from '../lessons/Lesson06_ImpliedVolatility'
import Lesson07 from '../lessons/Lesson07_Strategies'
import Lesson08 from '../lessons/Lesson08_EarningsPlays'
import Lesson09 from '../lessons/Lesson09_CoveredCalls'
import Lesson10 from '../lessons/Lesson10_CashSecuredPuts'
import Lesson11 from '../lessons/Lesson11_CreditSpreads'
import Lesson12 from '../lessons/Lesson12_AssignmentRisk'
import Lesson13 from '../lessons/Lesson13_ManagingShortPositions'
import clsx from 'clsx'

const LESSONS = [
  { id: 1,  title: 'Что такое опцион?',                subtitle: 'Аналогия с супермаркетом',          component: Lesson01 },
  { id: 2,  title: 'Коллы и путы',                     subtitle: 'Право купить vs. продать',           component: Lesson02 },
  { id: 3,  title: 'Почему опционы стоят своих денег', subtitle: 'Интуиция ценообразования',           component: Lesson03 },
  { id: 4,  title: 'Греки',                            subtitle: 'Спидометры вашей позиции',           component: Lesson04 },
  { id: 5,  title: 'Временной распад (Тета)',           subtitle: 'Лучший друг продавца',               component: Lesson05 },
  { id: 6,  title: 'Подразумеваемая волатильность',    subtitle: 'Сердце торговли опционами',          component: Lesson06 },
  { id: 7,  title: 'Торговые стратегии',               subtitle: 'Коллы, путы, спрэды и многое другое', component: Lesson07 },
  { id: 8,  title: 'Отчётность и коллапс ИВ',          subtitle: 'Самый практичный урок',              component: Lesson08 },
  { id: 9,  title: 'Покрытый Колл',                    subtitle: 'Доход с ваших акций',                component: Lesson09 },
  { id: 10, title: 'Обеспеченный Пут',                 subtitle: 'Купить акцию с дисконтом',           component: Lesson10 },
  { id: 11, title: 'Кредитные Спрэды',                 subtitle: 'Ограниченный риск при продаже',      component: Lesson11 },
  { id: 12, title: 'Риск Назначения',                  subtitle: 'Когда вас могут исполнить',          component: Lesson12 },
  { id: 13, title: 'Управление Позициями',             subtitle: 'Профессиональные правила выхода',    component: Lesson13 },
]

const TOTAL = LESSONS.length

export default function Academy() {
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const { progress, markComplete, setCurrentLesson, isCompleted, completionPercentage } = useAcademyProgress()

  const currentId = lessonId ? parseInt(lessonId) : progress.lastVisitedLesson || 1
  const lesson = LESSONS.find((l) => l.id === currentId) || LESSONS[0]
  const LessonComponent = lesson.component

  const quizSessionId = useMemo(() => {
    let id = localStorage.getItem('options_game_session_id')
    if (!id) {
      id = Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
      localStorage.setItem('options_game_session_id', id)
    }
    return id
  }, [])

  useEffect(() => {
    setCurrentLesson(currentId)
  }, [currentId, setCurrentLesson])

  const goToLesson = (id: number) => navigate(`/academy/${id}`)
  const nextLesson = () => {
    markComplete(currentId)
    if (currentId < TOTAL) goToLesson(currentId + 1)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="card space-y-4 sticky top-20">
            <div>
              <h2 className="font-bold text-white">Прогресс курса</h2>
              <ProgressBar
                value={completionPercentage}
                label={`${progress.completedLessons.length} / ${TOTAL} уроков`}
                className="mt-2"
                color="green"
              />
            </div>

            <nav className="space-y-1 max-h-[70vh] overflow-y-auto">
              {LESSONS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => goToLesson(l.id)}
                  className={clsx(
                    'w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-2',
                    l.id === currentId
                      ? 'bg-blue-600/20 border border-blue-600/40 text-blue-300'
                      : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200',
                    l.id > 8 && 'border-l-2 border-purple-700/40 pl-4',
                  )}
                >
                  <span className="flex-shrink-0 mt-0.5">
                    {isCompleted(l.id) ? (
                      <span className="text-green-500 text-sm">✓</span>
                    ) : (
                      <span className="text-gray-600 text-xs">{String(l.id).padStart(2, '0')}</span>
                    )}
                  </span>
                  <div>
                    <div className="text-sm font-medium leading-tight">{l.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{l.subtitle}</div>
                  </div>
                </button>
              ))}
            </nav>

            {progress.completedLessons.length >= 8 && (
              <div className="text-xs text-purple-400 text-center">
                ✨ Продвинутый курс разблокирован!
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="lg:col-span-3">
          <LessonComponent
            onComplete={nextLesson}
            isCompleted={isCompleted(currentId)}
            lessonNumber={currentId}
          />
          <LessonQuiz lessonId={currentId} userSessionId={quizSessionId} />
        </main>
      </div>
    </div>
  )
}
