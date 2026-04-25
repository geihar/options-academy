import { useState, useCallback } from 'react'

export interface QuizQuestion {
  id: string
  type: 'mcq' | 'estimate'
  question: string
  options?: string[]
  unit?: string
}

export interface QuizResultItem {
  question_id: string
  correct: boolean
  correct_answer: number | string
  explanation: string
  formula_steps?: string[]
}

export interface QuizState {
  questions: QuizQuestion[]
  currentIndex: number
  answers: Record<string, number | string>
  submitted: boolean
  results: QuizResultItem[]
  score: number
  total: number
  passed: boolean
  loading: boolean
  error: string | null
}

export function useQuiz(lessonId: number, userSessionId: string) {
  const [state, setState] = useState<QuizState>({
    questions: [], currentIndex: 0, answers: {}, submitted: false,
    results: [], score: 0, total: 0, passed: false, loading: false, error: null,
  })

  const loadQuiz = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`/api/quiz/${lessonId}`)
      if (!res.ok) throw new Error('Не удалось загрузить квиз')
      const data = await res.json()
      setState(s => ({ ...s, questions: data.questions, currentIndex: 0, answers: {}, submitted: false, results: [], loading: false }))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка'
      setState(s => ({ ...s, error: msg, loading: false }))
    }
  }, [lessonId])

  const setAnswer = useCallback((questionId: string, answer: number | string) => {
    setState(s => ({ ...s, answers: { ...s.answers, [questionId]: answer } }))
  }, [])

  const nextQuestion = useCallback(() => {
    setState(s => ({ ...s, currentIndex: Math.min(s.currentIndex + 1, s.questions.length - 1) }))
  }, [])

  const submitQuiz = useCallback(async (answers: Record<string, number | string>) => {
    setState(s => ({ ...s, loading: true }))
    try {
      const payload = Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer }))
      const res = await fetch(`/api/quiz/${lessonId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_session_id: userSessionId, answers: payload }),
      })
      if (!res.ok) throw new Error('Ошибка отправки ответов')
      const data = await res.json()
      setState(s => ({ ...s, submitted: true, results: data.results, score: data.score, total: data.total, passed: data.passed, loading: false }))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка'
      setState(s => ({ ...s, error: msg, loading: false }))
    }
  }, [lessonId, userSessionId])

  const reset = useCallback(() => {
    setState(s => ({ ...s, currentIndex: 0, answers: {}, submitted: false, results: [], score: 0, total: 0, passed: false }))
    loadQuiz()
  }, [loadQuiz])

  return { state, loadQuiz, setAnswer, nextQuestion, submitQuiz, reset }
}
