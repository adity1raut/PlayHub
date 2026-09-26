import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";

/**
 * Gives the notification system router navigation (NotificationProvider sits above
 * the Router). Mount once anywhere inside <Router>; renders nothing.
 * Without it, clicks on pop-ups / system notifications fall back to history.pushState.
 */
function NotificationToaster() {
  const navigate = useNavigate();
  const { registerNavigator } = useNotifications() ?? {};

  useEffect(() => {
    if (!registerNavigator) return undefined;
    return registerNavigator((to, options) => navigate(to, options));
  }, [navigate, registerNavigator]);

  return null;
}

export default NotificationToaster;
