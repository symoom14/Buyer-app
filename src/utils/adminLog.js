import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

export async function logAdminAction({
  action,
  targetType = "",
  targetId = "",
  targetLabel = "",
  metadata = {},
}) {
  const actor = auth.currentUser;
  if (!actor) return;

  try {
    await addDoc(collection(db, "adminLogs"), {
      action: String(action || "").trim().toLowerCase(),
      targetType: String(targetType || "").trim().toLowerCase(),
      targetId: String(targetId || ""),
      targetLabel: String(targetLabel || ""),
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      actorId: actor.uid,
      actorEmail: actor.email || "",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to write admin log:", error);
  }
}
