import type { TextInput } from 'react-native';

import type { CustomQuestion } from '@/features/customer/schemas/checkout';
import { QUESTION_WORDS } from '@/features/customer/ui/checkout/selectWords';
import { Input, ListRow, Stack, Text } from '@/shared/ui';

type Props = {
  questions: CustomQuestion[];
  answers: Record<string, string>;
  /** Question ids still needing an answer (shown after Continue). */
  missing: ReadonlySet<string>;
  onAnswer: (id: string, text: string) => void;
  /** Text answers register here so Continue can focus the first one missing. */
  inputRef: (id: string, input: TextInput | null) => void;
};

const ANSWER_MAX = 500;

// Spec P17: the organiser's questions; `required` is enforced here (the server doesn't).
export function QuestionFields({ questions, answers, missing, onAnswer, inputRef }: Props) {
  if (questions.length === 0) return null;
  return (
    <Stack gap="s4" testID="questions">
      <Text variant="headline">Questions from the organiser</Text>
      {questions.map((q) => {
        const label = q.required ? q.label : `${q.label} (optional)`;
        const error = missing.has(q.id) ? QUESTION_WORDS : undefined;
        if (q.type === 'select') {
          return (
            <Stack key={q.id} gap="s2" testID={`question-${q.id}`}>
              <Text variant="label">{label}</Text>
              {q.options.map((o) => (
                <ListRow
                  key={o}
                  title={o}
                  checked={answers[q.id] === o}
                  onPress={() => {
                    onAnswer(q.id, o);
                  }}
                />
              ))}
              {error !== undefined ? (
                <Text variant="bodySm" tone="dangerFg" accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}
            </Stack>
          );
        }
        return (
          <Input
            key={q.id}
            ref={(input) => {
              inputRef(q.id, input);
            }}
            label={label}
            value={answers[q.id] ?? ''}
            onChangeText={(t) => {
              onAnswer(q.id, t);
            }}
            multiline={q.type === 'textarea'}
            maxLength={ANSWER_MAX}
            error={error}
            testID={`question-${q.id}`}
          />
        );
      })}
    </Stack>
  );
}
