import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, ArrowRight, AtSign, Check, KeyRound, Mail, RefreshCw, Send, UserRound, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "../../components/layout/AuthLayout";
import { Alert, Button, Input, PasswordInput, Spinner } from "../../components/ui";
import { API_URL as backendUrl } from "../../lib/config";
import { toast } from "../../lib/toast";
import { cn } from "../../lib/cn";

const STEPS = ["Details", "Verify", "Password"];
const OTP_LENGTH = 6; // backend issues a 6-digit code, valid for 10 minutes
const RESEND_COOLDOWN = 60; // seconds before "Resend" is allowed
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/; // same rule as the server
const MIN_PASSWORD = 6;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Terminal-style numbered step row: "01 Details / 02 Verify / 03 Password". */
function StepIndicator({ steps, current }) {
  return (
    <ol
      className={cn(
        "mb-7 grid border-b border-border",
        steps.length === 4 ? "grid-cols-4" : "grid-cols-3",
      )}
      aria-label="Progress"
    >
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

const AvailabilityIcon = ({ status }) => {
  if (status === "checking") return <Spinner label="Checking availability" className="mr-1.5 size-4" />;
  if (status === "available") return <Check className="mr-2 size-4 text-success" aria-label="Available" />;
  if (status === "unavailable") return <X className="mr-2 size-4 text-destructive" aria-label="Already taken" />;
  return null;
};

const RegistrationForm = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
    otp: "",
  });
  const [loading, setLoading] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);
  const [availability, setAvailability] = useState({});
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (otpTimer <= 0) return undefined;
    const iv = setInterval(() => setOtpTimer((p) => p - 1), 1000);
    return () => clearInterval(iv);
  }, [otpTimer]);

  // Values exactly as the backend should receive them
  const clean = {
    username: formData.username.trim(),
    email: formData.email.trim().toLowerCase(),
    name: formData.name.trim(),
  };

  const handleChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;
    if (name === "otp") value = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setFormData((p) => ({ ...p, [name]: value }));
    if (error) setError(null);
    if (name === "username" || name === "email") setAvailability((p) => ({ ...p, [name]: null }));
    // A new email needs a new code
    if (name === "email" && otpSent) {
      setOtpSent(false);
      setOtpTimer(0);
      setFormData((p) => ({ ...p, otp: "" }));
    }
  };

  /** POST /api/auth/check-availability { identifier } → 200 available / 400 taken. Returns true when free. */
  const checkAvailability = async (field) => {
    const value = clean[field];
    if (!value) return false;
    if (field === "email" && !EMAIL_RE.test(value)) {
      setAvailability((p) => ({ ...p, email: "unavailable" }));
      return false;
    }
    setAvailability((p) => ({ ...p, [field]: "checking" }));
    try {
      await axios.post(`${backendUrl}/api/auth/check-availability`, { identifier: value });
      setAvailability((p) => ({ ...p, [field]: "available" }));
      return true;
    } catch (err) {
      if (err.response?.status === 400) {
        setAvailability((p) => ({ ...p, [field]: "unavailable" }));
      } else {
        setAvailability((p) => ({ ...p, [field]: null }));
        setError(err.response?.data?.message || "Couldn't check availability. Please try again.");
      }
      return false;
    }
  };

  const ensureAvailable = async (field) =>
    availability[field] === "available" || (await checkAvailability(field));

  const sendOTP = async () => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${backendUrl}/api/auth/send-otp`, { email: clean.email });
      setOtpSent(true);
      setOtpTimer(RESEND_COOLDOWN);
      toast.success("Verification code sent to your email");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${backendUrl}/api/auth/resend-otp`, { email: clean.email });
      setOtpTimer(RESEND_COOLDOWN);
      setFormData((p) => ({ ...p, otp: "" }));
      toast.success("New code sent — use the code from this newest email");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend");
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    setStepLoading(true);
    setError(null);
    try {
      await axios.post(`${backendUrl}/api/auth/verify-otp`, {
        email: clean.email,
        otp: formData.otp,
      });
      toast.success("Email verified");
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    } finally {
      setStepLoading(false);
    }
  };

  const register = async (e) => {
    e?.preventDefault();
    if (formData.password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Body fields match backend registerUser(): username, email, name, otp, password, confirmPassword
      const res = await axios.post(`${backendUrl}/api/auth/register`, {
        username: clean.username,
        email: clean.email,
        name: clean.name,
        otp: formData.otp,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });
      if (res.data.success) {
        toast.success("Account created — sign in to continue");
        // The register endpoint doesn't set the auth cookie, so send the user to sign in.
        navigate("/login", { replace: true });
      } else {
        setError(res.data.message || "Registration failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async (e) => {
    e?.preventDefault();
    setError(null);
    if (step === 1) {
      if (!clean.username || !clean.email || !clean.name) {
        setError("Please fill in all fields");
        return;
      }
      if (!USERNAME_RE.test(clean.username)) {
        setError("Username must be 3–30 characters: letters, numbers, _ or .");
        return;
      }
      if (!EMAIL_RE.test(clean.email)) {
        setError("Please enter a valid email address");
        return;
      }
      setStepLoading(true);
      const usernameOk = await ensureAvailable("username");
      const emailOk = await ensureAvailable("email");
      setStepLoading(false);
      if (!usernameOk || !emailOk) {
        setError("Please choose a username and email that aren't already in use");
        return;
      }
      setStep(2);
    } else if (step === 2 && otpSent) {
      if (formData.otp.length !== OTP_LENGTH) {
        setError(`Enter the ${OTP_LENGTH}-digit code`);
        return;
      }
      verifyOTP();
    }
  };

  const goBack = () => {
    setError(null);
    setStep((p) => Math.max(1, p - 1));
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const busy = loading || stepLoading;
  const passwordsMatch =
    formData.password && formData.confirmPassword && formData.password === formData.confirmPassword;
  const longEnough = formData.password.length >= MIN_PASSWORD;

  const subtitles = {
    1: "Pick a username and tell us who you are.",
    2: "Confirm your email address with a one-time code.",
    3: "Choose a password to secure your account.",
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle={subtitles[step]}
      status={`Step ${step}/3`}
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <StepIndicator steps={STEPS} current={step} />

      {step === 1 && (
        <form onSubmit={nextStep} className="space-y-4" noValidate>
          <Input
            label="Full name"
            name="name"
            icon={UserRound}
            value={formData.name}
            onChange={handleChange}
            disabled={busy}
            autoComplete="name"
            placeholder="Your full name"
            required
          />
          <Input
            label="Username"
            name="username"
            icon={AtSign}
            value={formData.username}
            onChange={handleChange}
            onBlur={() => checkAvailability("username")}
            disabled={busy}
            autoComplete="username"
            placeholder="Choose a username"
            trailing={<AvailabilityIcon status={availability.username} />}
            error={availability.username === "unavailable" ? "That username is already taken" : undefined}
            hint={availability.username === "available" ? "Username is available" : "3–30 characters: letters, numbers, _ or ."}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            icon={Mail}
            value={formData.email}
            onChange={handleChange}
            onBlur={() => checkAvailability("email")}
            disabled={busy}
            autoComplete="email"
            placeholder="you@example.com"
            trailing={<AvailabilityIcon status={availability.email} />}
            error={
              availability.email === "unavailable"
                ? EMAIL_RE.test(clean.email)
                  ? "An account with this email already exists"
                  : "Enter a valid email address"
                : undefined
            }
            required
          />

          {error && (
            <Alert variant="destructive" className="animate-shake">
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="solid"
            size="lg"
            fullWidth
            loading={stepLoading}
            iconRight={ArrowRight}
            disabled={
              loading ||
              !formData.username.trim() ||
              !formData.email.trim() ||
              !formData.name.trim() ||
              availability.username === "checking" ||
              availability.email === "checking"
            }
          >
            Continue
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={nextStep} className="space-y-4" noValidate>
          <div className="border border-dashed border-border-strong px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            <span className="text-primary">&gt;</span> We&apos;ll send a {OTP_LENGTH}-digit code to{" "}
            <span className="font-bold break-all text-foreground">{clean.email}</span>
          </div>

          {!otpSent ? (
            <>
              {error && (
                <Alert variant="destructive" className="animate-shake">
                  {error}
                </Alert>
              )}
              <Button variant="solid" size="lg" fullWidth icon={Send} loading={loading} onClick={sendOTP}>
                Send verification code
              </Button>
            </>
          ) : (
            <>
              <Input
                label="Verification code"
                name="otp"
                value={formData.otp}
                onChange={handleChange}
                disabled={stepLoading}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_LENGTH}
                placeholder={"0".repeat(OTP_LENGTH)}
                autoFocus
                inputClassName="h-14 text-center text-2xl font-extrabold tracking-[0.6em] tabular-nums placeholder:text-faint/50"
              />
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-faint">
                  Valid for 10 minutes · use the newest email
                  {otpTimer > 0 && ` · resend in ${formatTime(otpTimer)}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={RefreshCw}
                  onClick={resendOTP}
                  disabled={otpTimer > 0 || loading}
                >
                  Resend
                </Button>
              </div>

              {error && (
                <Alert variant="destructive" className="animate-shake">
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                variant="solid"
                size="lg"
                fullWidth
                icon={KeyRound}
                loading={stepLoading}
                disabled={loading || formData.otp.length !== OTP_LENGTH}
              >
                Verify code
              </Button>
            </>
          )}
        </form>
      )}

      {step === 3 && (
        <form onSubmit={register} className="space-y-4" noValidate>
          <PasswordInput
            name="password"
            value={formData.password}
            onChange={handleChange}
            disabled={loading}
            autoComplete="new-password"
            placeholder="Create a password"
            required
          />
          <PasswordInput
            label="Confirm password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={loading}
            autoComplete="new-password"
            placeholder="Repeat your password"
            required
          />
          <ul className="space-y-1 text-[11px]">
            <li className={longEnough ? "text-success" : "text-faint"}>
              {longEnough ? "[✓]" : "[ ]"} At least {MIN_PASSWORD} characters
            </li>
            <li className={passwordsMatch ? "text-success" : formData.confirmPassword ? "text-destructive" : "text-faint"}>
              {passwordsMatch ? "[✓]" : formData.confirmPassword ? "[✗]" : "[ ]"} Passwords match
            </li>
          </ul>

          {error && (
            <Alert variant="destructive" className="animate-shake">
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="solid"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!passwordsMatch || !longEnough}
          >
            Create account
          </Button>
        </form>
      )}

      {step > 1 && (
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={goBack} disabled={busy} className="mt-5">
          Back
        </Button>
      )}
    </AuthLayout>
  );
};

export default RegistrationForm;
