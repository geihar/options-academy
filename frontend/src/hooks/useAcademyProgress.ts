import { useState, useCallback } from 'react'

const STORAGE_KEY = 'options_academy_progress'

export interface AcademyProgress {
  completedLessons: number[]
  lastVisitedLesson: number
}

function loadProgress(): AcademyProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore parse errors
  }
  return { completedLessons: [], lastVisitedLesson: 1 }
}

function saveProgress(progress: AcademyProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // ignore storage errors
  }
}

export function useAcademyProgress() {
  const [progress, setProgress] = useState<AcademyProgress>(loadProgress)

  const markComplete = useCallback((lessonId: number) => {
    setProgress((prev) => {
      const updated: AcademyProgress = {
        ...prev,
        completedLessons: prev.completedLessons.includes(lessonId)
          ? prev.completedLessons
          : [...prev.completedLessons, lessonId],
        lastVisitedLesson: lessonId,
      }
      saveProgress(updated)
      return updated
    })
  }, [])

  const setCurrentLesson = useCallback((lessonId: number) => {
    setProgress((prev) => {
      const updated = { ...prev, lastVisitedLesson: lessonId }
      saveProgress(updated)
      return updated
    })
  }, [])

  const isCompleted = useCallback(
    (lessonId: number) => progress.completedLessons.includes(lessonId),
    [progress.completedLessons]
  )

  const completionPercentage = Math.round((progress.completedLessons.length / 13) * 100)

  return {
    progress,
    markComplete,
    setCurrentLesson,
    isCompleted,
    completionPercentage,
  }
}
