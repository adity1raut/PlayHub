import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, AtSign, Check, KeyRound, Lock, Mail, RefreshCw, Send, Timer } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import { Alert, Button, Input, Label, OtpInput, PasswordInput } from "../../components/ui";
import { API_URL } from "../../lib/config";
import { toast } from "../../lib/toast";
import { cn } from "../../lib/cn";

const STEPS = ["Find", "Verify", "Reset", "Done"];
const OTP_LENGTH = 6; // backend issues a 6-digit code, valid for 10 minutes
const RESEND_COOLDOWN = 60; // seconds before "Resend" is allowed
const MIN_PASSWORD = 6;
const REDIRECT_SECONDS = 5;

/** Terminal-style numbered step row: "01 Find / 02 Verify / 03 Reset / 04 Done". */
function StepIndicator({ steps, current }) {
  return (
    <ol className="mb-7 grid grid-cols-4 border-b border-border" aria-label="Progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn(
              "-mb-px flex min-w-0 items-center gap-1.5 border-b-2 pb-2.5 text-[10px] font-bold tracking-[0.12em] uppercase transition-colors",
              active
                ? "border-primary text-primary"
                : done
                  ? "border-primary/30 text-muted-foreground"
                  : "border-transparent text-faint",
            )}
          >
            <span className="shrink-0 tabular-nums">
              {done ? <Check className="size-3 text-primary" aria-label="Done" /> : String(n).padStart(2, "0")}
            </span>
            <span className="truncate">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

const errorMessage = (err, fallback) => err?.response?.data?.message || fallback;

const ForgetPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    identifier: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [countdown, setCountdown] = useState(0);
  const [redirectIn, setRedirectIn] = useState(REDIRECT_SECONDS);
  const [error, setError] = useState(null);
  const [buttonLoading, setButtonLoading] = useState({
    sendOTP: false,
    resendOTP: false,
    verifyOTP: false,
    resetPassword: false,
  });

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // After a successful reset, count down and hand the user to the sign-in page
  useEffect(() => {
    if (step !== 4) return undefined;
    if (redirectIn <= 0) {
      navigate("/login", { replace: true });
      return undefined;
    }
    const t = setTimeout(() => setRedirectIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, redirectIn, navigate]);

  const handleChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;
    if (name === "otp") value = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setFormData((p) => ({ ...p, [name]: value }));
    if (error) setError(null);
  };

  const setLoading = (key, val) => setButtonLoading((p) => ({ ...p, [key]: val }));

  const identifier = formData.identifier.trim();

  // POST /api/auth/send-reset-otp { identifier }
  const sendOTP = async (e) => {
    e?.preventDefault();
    if (!identifier) {
      setError("Please enter your email or username");
      return;
    }
    setLoading("sendOTP", true);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/api/auth/send-reset-otp`, { identifier });
      if (res.data.success) {
        toast.success("Recovery code sent to your email");
        setFormData((p) => ({ ...p, otp: "" }));
        setStep(2);
        setCountdown(RESEND_COOLDOWN);
      } else {
        setError(res.data.message || "Failed to send code");
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to send code. Please try again."));
    } finally {
      setLoading("sendOTP", false);
    }
  };

  // POST /api/auth/resend-reset-otp { identifier }
  const resendOTP = async () => {
    setLoading("resendOTP", true);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/api/auth/resend-reset-otp`, { identifier });
      if (res.data.success) {
        toast.success("New code sent");
        setFormData((p) => ({ ...p, otp: "" }));
        setCountdown(RESEND_COOLDOWN);
      } else {
        setError(res.data.message || "Failed to resend");
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to resend. Please try again."));
    } finally {
      setLoading("resendOTP", false);
    }
  };

  // POST /api/auth/verify-reset-otp { identifier, otp }
  const verifyOTP = async (e, codeArg) => {
    e?.preventDefault?.();
    const code = codeArg ?? formData.otp;
    if (code.length !== OTP_LENGTH) {
      setError(`Please enter the ${OTP_LENGTH}-digit code`);
      return;
    }
    setLoading("verifyOTP", true);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/api/auth/verify-reset-otp`, {
        identifier,
        otp: code,
      });
      if (res.data.success) {
        toast.success("Code verified");
        setStep(3);
      } else {
        setError(res.data.message || "Invalid or expired code");
      }
    } catch (err) {
      setError(errorMessage(err, "Verification failed. Please try again."));
    } finally {
      setLoading("verifyOTP", false);
    }
  };

  // POST /api/auth/reset-password { identifier, newPassword }
  const resetPassword = async (e) => {
    e?.preventDefault();
    if (!formData.newPassword) {
      setError("Please enter a new password");
      return;
    }
    if (formData.newPassword.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading("resetPassword", true);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/api/auth/reset-password`, {
        identifier,
        newPassword: formData.newPassword,
      });
      if (res.data.success) {
        toast.success("Password updated successfully");
        setRedirectIn(REDIRECT_SECONDS);
        setStep(4);
      } else {
        setError(res.data.message || "Failed to reset password");
      }
    } catch (err) {
      setError(errorMessage(err, "Failed to reset password. Please try again."));
    } finally {
      setLoading("resetPassword", false);
    }
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const longEnough = formData.newPassword.length >= MIN_PASSWORD;
  const passwordsMatch =
    formData.newPassword && formData.confirmPassword && formData.newPassword === formData.confirmPassword;

  const subtitles = {
    1: "Enter your email or username and we'll send you a recovery code.",
    2: "Enter the code we just emailed you.",
    3: "Choose a new password for your account.",
    4: "Your password has been reset.",
  };

  const errorAlert = error && (
    <Alert variant="destructive" className="animate-shake">
      {error}
    </Alert>
  );

  return (
    <AuthLayout
      title={step === 4 ? "Password updated" : "Reset password"}
      subtitle={subtitles[step]}
      status="Recovery"
      footer={
        step < 4 ? (
          <>
            Remember your password?{" "}
            <Link to="/login" className="font-bold text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        ) : null
      }
    >
      <StepIndicator steps={STEPS} current={step} />

      {step === 1 && (
        <form onSubmit={sendOTP} className="space-y-4" noValidate>
          <Input
            label="Email or username"
            name="identifier"
            icon={AtSign}
            value={formData.identifier}
            onChange={handleChange}
            disabled={buttonLoading.sendOTP}
            autoComplete="username"
            placeholder="you@example.com"
            autoFocus
            required
          />
          {errorAlert}
          <Button
            type="submit"
            variant="solid"
            size="lg"
            fullWidth
            icon={Send}
            loading={buttonLoading.sendOTP}
            disabled={!identifier}
          >
            Send recovery code
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={verifyOTP} className="space-y-4" noValidate>
          <div className="flex gap-3 border border-dashed border-border-strong bg-muted/40 px-4 py-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Check your inbox — we sent a {OTP_LENGTH}-digit code from{" "}
              <span className="text-foreground">Spawnpoint</span> to the email for{" "}
              <span className="font-bold break-all text-foreground">{identifier}</span>
              <span className="block text-faint">Not there? Check spam or promotions.</span>
            </p>
          </div>
          <div>
            <Label>Reset code</Label>
            <OtpInput
              value={formData.otp}
              length={OTP_LENGTH}
              onChange={(otp) => {
                setFormData((p) => ({ ...p, otp }));
                if (error) setError(null);
              }}
              onComplete={(code) => !buttonLoading.verifyOTP && verifyOTP(null, code)}
              disabled={buttonLoading.verifyOTP}
              invalid={Boolean(error)}
              label="Reset code"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-faint">
              <Timer className="size-3.5" aria-hidden="true" />
              Valid for 10 minutes · use the newest email
            </span>
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              onClick={resendOTP}
              loading={buttonLoading.resendOTP}
              disabled={countdown > 0}
            >
              {countdown > 0 ? `Resend ${formatTime(countdown)}` : "Resend"}
            </Button>
          </div>
          {errorAlert}
          <Button
            type="submit"
            variant="solid"
            size="lg"
            fullWidth
            icon={KeyRound}
            loading={buttonLoading.verifyOTP}
            disabled={formData.otp.length !== OTP_LENGTH}
          >
            Verify code
          </Button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={resetPassword} className="space-y-4" noValidate>
          <PasswordInput
            label="New password"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            disabled={buttonLoading.resetPassword}
            autoComplete="new-password"
            placeholder="New password"
            autoFocus
            required
          />
          <PasswordInput
            label="Confirm password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={buttonLoading.resetPassword}
            autoComplete="new-password"
            placeholder="Confirm new password"
            required
          />
          <ul className="space-y-1 text-[11px]">
            <li className={longEnough ? "text-success" : "text-faint"}>
              {longEnough ? "[✓]" : "[ ]"} At least {MIN_PASSWORD} characters
            </li>
            <li
              className={
                passwordsMatch ? "text-success" : formData.confirmPassword ? "text-destructive" : "text-faint"
              }
            >
              {passwordsMatch ? "[✓]" : formData.confirmPassword ? "[✗]" : "[ ]"} Passwords match
            </li>
          </ul>
          {errorAlert}
          <Button
            type="submit"
            variant="solid"
            size="lg"
            fullWidth
            icon={Lock}
            loading={buttonLoading.resetPassword}
            disabled={!formData.newPassword || !formData.confirmPassword}
          >
            Update password
          </Button>
        </form>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <Alert variant="success" title="Access restored">
            You can now sign in with your new password.
          </Alert>
          <p className="text-[11px] text-faint" role="status">
            <span className="text-primary">&gt;</span> Redirecting to sign in in{" "}
            <span className="tabular-nums text-foreground">{redirectIn}s</span>
            <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-blink bg-primary" aria-hidden="true" />
          </p>
          <Button as={Link} to="/login" replace variant="solid" size="lg" fullWidth>
            Go to sign in
          </Button>
        </div>
      )}

      {step > 1 && step < 4 && (
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={goBack}
          disabled={buttonLoading.verifyOTP || buttonLoading.resetPassword}
          className="mt-5"
        >
          Back
        </Button>
      )}
    </AuthLayout>
  );
};

export default ForgetPassword;
