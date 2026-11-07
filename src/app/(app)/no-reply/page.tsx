import { redirect } from "next/navigation";

/** No Reply became Funnel; old bookmarks still land in the right place. */
export default function NoReplyPage() {
  redirect("/funnel");
}
