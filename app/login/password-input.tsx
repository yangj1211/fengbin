'use client';
import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function PasswordInput({
  label = '密码',
  ...props
}: ComponentProps<typeof Input> & { label?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <Input {...props} type={visible ? 'text' : 'password'} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${visible ? '隐藏' : '显示'}${label}`}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </Button>
    </div>
  );
}
