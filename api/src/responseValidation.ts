export type ResponseAnswer = string | string[] | boolean | number
export type QuestionType =
  | 'categorical-single'
  | 'categorical-multiple'
  | 'boolean'
  | 'ordinal'
  | 'numeric'
  | 'text'

export interface QuestionConfig {
  questionType: QuestionType
  allowSuggestions: boolean
  allowVoting?: boolean
  options?: string[]
  numericMin?: number
  numericMax?: number
}

const QUESTION_TYPES: readonly QuestionType[] = [
  'categorical-single',
  'categorical-multiple',
  'boolean',
  'ordinal',
  'numeric',
  'text',
]

export function validateQuestion(question: Partial<QuestionConfig>): string[] {
  const errors: string[] = []
  if (!QUESTION_TYPES.includes(question.questionType as QuestionType)) {
    errors.push('questionType must be a supported question type.')
    return errors
  }

  const choices = question.options
  if (question.questionType === 'categorical-single' || question.questionType === 'categorical-multiple' || question.questionType === 'ordinal') {
    if (!Array.isArray(choices) || choices.length < 2 || choices.some((choice) => typeof choice !== 'string' || !choice.trim())) {
      errors.push('This question type requires at least two non-empty options.')
    } else if (new Set(choices.map((choice) => choice.trim().toLocaleLowerCase())).size !== choices.length) {
      errors.push('Question options must be unique.')
    }
  } else if (choices !== undefined) {
    errors.push('Options are only supported for categorical and ordinal questions.')
  }

  if (question.questionType === 'numeric') {
    if (question.numericMin !== undefined && !Number.isFinite(question.numericMin)) {
      errors.push('numericMin must be a finite number.')
    }
    if (question.numericMax !== undefined && !Number.isFinite(question.numericMax)) {
      errors.push('numericMax must be a finite number.')
    }
    if (
      question.numericMin !== undefined &&
      question.numericMax !== undefined &&
      question.numericMin > question.numericMax
    ) {
      errors.push('numericMin cannot exceed numericMax.')
    }
  } else if (question.numericMin !== undefined || question.numericMax !== undefined) {
    errors.push('Numeric bounds are only supported for numeric questions.')
  }

  if (question.questionType !== 'text' && question.allowVoting !== undefined) {
    errors.push('allowVoting is only supported for text questions.')
  }
  if (question.allowVoting !== undefined && typeof question.allowVoting !== 'boolean') {
    errors.push('allowVoting must be a boolean.')
  }
  if (typeof question.allowSuggestions !== 'boolean') {
    errors.push('allowSuggestions must be a boolean.')
  }

  return errors
}

export function validateResponse(question: QuestionConfig, answer: unknown): string | undefined {
  switch (question.questionType) {
    case 'categorical-single':
    case 'ordinal':
      if (typeof answer !== 'string' || !question.options?.includes(answer)) {
        return 'Choose one of the available options.'
      }
      return
    case 'categorical-multiple':
      if (
        !Array.isArray(answer) ||
        answer.length === 0 ||
        answer.some((item) => typeof item !== 'string' || !question.options?.includes(item)) ||
        new Set(answer).size !== answer.length
      ) {
        return 'Choose one or more unique available options.'
      }
      return
    case 'boolean':
      return typeof answer === 'boolean' ? undefined : 'Answer must be true or false.'
    case 'numeric':
      if (typeof answer !== 'number' || !Number.isFinite(answer)) {
        return 'Answer must be a finite number.'
      }
      if (question.numericMin !== undefined && answer < question.numericMin) {
        return `Answer must be at least ${question.numericMin}.`
      }
      if (question.numericMax !== undefined && answer > question.numericMax) {
        return `Answer must be no more than ${question.numericMax}.`
      }
      return
    case 'text':
      if (typeof answer !== 'string' || !answer.trim()) {
        return 'Answer must not be empty.'
      }
      if (Array.from(answer).length > 250) {
        return 'Answers can be up to 250 characters long.'
      }
      if (/[<>]/u.test(answer)) {
        return 'Answers cannot contain angle brackets.'
      }
      return
  }
}
