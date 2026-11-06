import { AuthFrame } from '@/components/auth-frame';
import { ForgotPasswordForm } from './forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <AuthFrame>
      <div className="rounded-card bg-white p-5 shadow-card">
        <ForgotPasswordForm />
      </div>
    </AuthFrame>
  );
}
