/**
 * Dynamic Input Field Component
 *
 * Renders appropriate input field based on AgentInput type
 * Supports: string, number, boolean, url, email, array, object
 */

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { AgentInput } from '@/lib/types';

interface DynamicInputFieldProps {
  input: AgentInput;
  register: UseFormRegister<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

export function DynamicInputField({
  input,
  register,
  errors,
  value,
  onChange,
}: DynamicInputFieldProps) {
  const error = errors[input.name];
  const fieldId = `input-${input.name}`;

  // Build validation rules
  const validation: Record<string, unknown> = {};
  if (input.required) {
    validation.required = `${input.name} is required`;
  }
  if (input.validation?.min !== undefined) {
    validation.min = {
      value: input.validation.min,
      message: `Minimum value is ${input.validation.min}`,
    };
  }
  if (input.validation?.max !== undefined) {
    validation.max = {
      value: input.validation.max,
      message: `Maximum value is ${input.validation.max}`,
    };
  }
  if (input.validation?.pattern) {
    validation.pattern = {
      value: new RegExp(input.validation.pattern),
      message: `Invalid format for ${input.name}`,
    };
  }
  if (input.validation?.enum) {
    validation.validate = (val: unknown) => {
      if (input.validation?.enum?.includes(String(val))) {
        return true;
      }
      return `Must be one of: ${input.validation?.enum?.join(', ') || 'valid values'}`;
    };
  }

  // Email validation
  if (input.type === 'email') {
    validation.pattern = {
      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
      message: 'Invalid email address',
    };
  }

  // URL validation
  if (input.type === 'url') {
    validation.pattern = {
      value: /^https?:\/\/.+/i,
      message: 'Invalid URL (must start with http:// or https://)',
    };
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>
        {input.name}
        {input.required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {/* String/Text Input */}
      {input.type === 'string' && (
        <Input
          id={fieldId}
          type="text"
          placeholder={input.description}
          defaultValue={input.default as string}
          {...register(input.name, validation)}
        />
      )}

      {/* Number Input */}
      {input.type === 'number' && (
        <Input
          id={fieldId}
          type="number"
          placeholder={input.description}
          defaultValue={input.default as number}
          {...register(input.name, {
            ...validation,
            valueAsNumber: true,
          })}
        />
      )}

      {/* Email Input */}
      {input.type === 'email' && (
        <Input
          id={fieldId}
          type="email"
          placeholder={input.description}
          defaultValue={input.default as string}
          {...register(input.name, validation)}
        />
      )}

      {/* URL Input */}
      {input.type === 'url' && (
        <Input
          id={fieldId}
          type="url"
          placeholder={input.description}
          defaultValue={input.default as string}
          {...register(input.name, validation)}
        />
      )}

      {/* Boolean Checkbox */}
      {input.type === 'boolean' && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={fieldId}
            defaultChecked={input.default as boolean}
            onCheckedChange={(checked) => onChange?.(checked)}
            {...register(input.name)}
          />
          <label
            htmlFor={fieldId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {input.description}
          </label>
        </div>
      )}

      {/* Array Input (JSON) */}
      {input.type === 'array' && (
        <Textarea
          id={fieldId}
          placeholder={`${input.description} (JSON array, e.g., ["item1", "item2"])`}
          defaultValue={
            input.default ? JSON.stringify(input.default, null, 2) : '[]'
          }
          rows={4}
          {...register(input.name, {
            ...validation,
            validate: (val: unknown) => {
              try {
                const parsed = JSON.parse(String(val));
                if (!Array.isArray(parsed)) {
                  return 'Must be a valid JSON array';
                }
                return true;
              } catch {
                return 'Invalid JSON format';
              }
            },
          })}
        />
      )}

      {/* Object Input (JSON) */}
      {input.type === 'object' && (
        <Textarea
          id={fieldId}
          placeholder={`${input.description} (JSON object, e.g., {"key": "value"})`}
          defaultValue={
            input.default ? JSON.stringify(input.default, null, 2) : '{}'
          }
          rows={4}
          {...register(input.name, {
            ...validation,
            validate: (val: unknown) => {
              try {
                const parsed = JSON.parse(String(val));
                if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                  return 'Must be a valid JSON object';
                }
                return true;
              } catch {
                return 'Invalid JSON format';
              }
            },
          })}
        />
      )}

      {/* Help Text */}
      {input.description && input.type !== 'boolean' && (
        <p className="text-sm text-gray-500">{input.description}</p>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-500">
          {error.message as string}
        </p>
      )}
    </div>
  );
}
