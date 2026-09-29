export type ResponseAnswer = string | string[] | boolean | number
export type QuestionType =
  | 'categorical'
  | 'boolean'
  | 'ordinal'
  | 'numeric'
  | 'text'

export interface QuestionConfig {
  questionType: QuestionType
  allowSuggestions: boolean
  required?: boolean
  maxSize?: number
  numberOfVotes?: number
  duplicateVotingAllowed?: boolean
  options?: string[]
  numericMin?: number
  numericMax?: number
}

const QUESTION_TYPES: readonly QuestionType[] = [
  'categorical',
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
  if (question.questionType === 'categorical' || question.questionType === 'ordinal') {
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

  if (question.required !== undefined && typeof question.required !== 'boolean') {
    errors.push('required must be a boolean.')
  }
  if (question.questionType === 'text') {
    if (question.maxSize !== undefined && (!Number.isInteger(question.maxSize) || question.maxSize < 1)) {
      errors.push('maxSize must be a positive integer.')
    }
    if (question.numberOfVotes !== undefined && (!Number.isInteger(question.numberOfVotes) || question.numberOfVotes < 0)) {
      errors.push('numberOfVotes must be a non-negative integer.')
    }
    if (question.duplicateVotingAllowed !== undefined && typeof question.duplicateVotingAllowed !== 'boolean') {
      errors.push('duplicateVotingAllowed must be a boolean.')
    }
  } else if (question.questionType === 'categorical') {
    if (question.numberOfVotes !== undefined && (!Number.isInteger(question.numberOfVotes) || question.numberOfVotes < 1)) {
      errors.push('numberOfVotes must be a positive integer for categorical questions.')
    }
    if (question.duplicateVotingAllowed !== undefined && typeof question.duplicateVotingAllowed !== 'boolean') {
      errors.push('duplicateVotingAllowed must be a boolean.')
    }
    if (question.maxSize !== undefined) {
      errors.push('maxSize is only supported for text questions.')
    }
  } else if (
    question.maxSize !== undefined ||
    question.numberOfVotes !== undefined ||
    question.duplicateVotingAllowed !== undefined
  ) {
    errors.push('Text and categorical voting settings are not supported for this question type.')
  }
  if (typeof question.allowSuggestions !== 'boolean') {
    errors.push('allowSuggestions must be a boolean.')
  } else if (question.questionType !== 'text' && question.allowSuggestions) {
    errors.push('allowSuggestions is only supported for text questions.')
  }

  return errors
}

export function validateResponse(question: QuestionConfig, answer: unknown): string | undefined {
  const unanswered =
    answer === undefined ||
    answer === null ||
    (typeof answer === 'string' && !answer.trim()) ||
    (Array.isArray(answer) && answer.length === 0)
  if (unanswered) {
    return question.required === true ? 'An answer is required.' : undefined
  }

  switch (question.questionType) {
    case 'ordinal':
      if (typeof answer !== 'string' || !question.options?.includes(answer)) {
        return 'Choose one of the available options.'
      }
      return
    case 'categorical':
      const maxSelections = question.numberOfVotes ?? 1
      if (
        !Array.isArray(answer) ||
        answer.length > maxSelections ||
        answer.some((item) => typeof item !== 'string' || !question.options?.includes(item)) ||
        (question.duplicateVotingAllowed !== true && new Set(answer).size !== answer.length)
      ) {
        return `Choose up to ${maxSelections} available option${maxSelections === 1 ? '' : 's'}${question.duplicateVotingAllowed ? '' : ' without duplicates'}.`
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
      if (typeof answer !== 'string') {
        return 'Answer must not be empty.'
      }
      const maxSize = question.maxSize ?? 250
      if (Array.from(answer).length > maxSize) {
        return `Answers can be up to ${maxSize} characters long.`
      }
      if (/[<>]/u.test(answer)) {
        return 'Answers cannot contain angle brackets.'
      }
      return
  }
}
