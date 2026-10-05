"use client";

import LoginGate from "./LoginGate";
import LoginManagerView from "./LoginManagerView";

export default function LoginManagerScreen() {
  return (
    <LoginGate>
      {(locker) => <LoginManagerView locker={locker} />}
    </LoginGate>
  );
}
