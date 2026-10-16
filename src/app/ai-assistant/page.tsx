import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AiAssistantUnavailablePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Sparkles className="h-8 w-8 text-neutral-500" aria-hidden />
      <h1 className="text-xl font-semibold">Admin AI Assistant is not available</h1>
      <p className="max-w-md text-sm text-neutral-500">
        This feature is not part of this release. The shopper-facing Stylist is unaffected.
      </p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to overview
      </Link>
    </div>
  );
}
