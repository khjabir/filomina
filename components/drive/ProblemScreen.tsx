"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Mark } from "@/components/brand/Mark";
import { AssistantBubble } from "@/components/assistant/AssistantBubble";
import { Button } from "@/components/ui/Button";
import { useDrive } from "@/components/providers/DriveProvider";
import { ConnectFolderDialog } from "./ConnectFolder";
import { GoogleButton } from "./SignInScreen";

export function ProblemScreen({ message }: { message: string }) {
  const { refresh, status, user, signInHref, loading } = useDrive();
  const [dialog, setDialog] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-5 py-12">
      <Mark state="error" size={64} />
      <AssistantBubble message={message} state="error" className="w-full" />
      <div className="flex w-full flex-col gap-2">
        <Button variant="secondary" size="lg" onClick={() => setDialog(true)}>
          Connect a different folder
        </Button>
        {status?.oauthConfigured && !user && <GoogleButton href={signInHref()} label="Sign in with another Google account" />}
        <Button variant="ghost" onClick={() => refresh()} loading={loading} icon={<RefreshCw className="size-4" />}>
          Try again
        </Button>
      </div>
      <ConnectFolderDialog open={dialog} onClose={() => setDialog(false)} />
    </div>
  );
}
