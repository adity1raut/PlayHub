import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AtSign } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "../../components/layout/AuthLayout";
import { Alert, Button, Input, PasswordInput } from "../../components/ui";

const LoginForm = () => {
  const [formData, setFormData] = useState({ identifier: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.identifier || !formData.password) {
      setError("Please fill in all fields");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const res = await login(formData.identifier.trim(), formData.password);
    setIsSubmitting(false);
    if (res?.success) {
      navigate(location.state?.from || "/dashboard", { replace: true });
    } else {
      setError(res?.message || "Couldn't sign you in. Please try again.");
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to PlayHub."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="font-bold text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email or username"
          name="identifier"
          icon={AtSign}
          value={formData.identifier}
          onChange={handleInputChange}
          disabled={isSubmitting}
          autoComplete="username"
          placeholder="you@example.com"
          required
        />
        <div>
          <PasswordInput
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            disabled={isSubmitting}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
          <div className="mt-2 text-right">
            <Link
              to="/forgot-password"
              className="text-[11px] text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="animate-shake">
            {error}
          </Alert>
        )}

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={isSubmitting}
          disabled={!formData.identifier || !formData.password}
        >
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
};

export default LoginForm;
