import LoginGate from "./LoginGate";
import LoginManagerView from "./LoginManagerView";

export default function LoginManagerPage() {
  return <LoginGate>{(locker) => <LoginManagerView locker={locker} />}</LoginGate>;
}
