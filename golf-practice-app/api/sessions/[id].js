// DELETE /api/sessions/:id -> 204
import { deleteSession } from "../_lib/db.js";
import { error, withPlayer, ID_RE } from "../_lib/http.js";

export const DELETE = withPlayer(async (request, key) => {
  const id = decodeURIComponent(new URL(request.url).pathname.split("/").pop());
  if (!ID_RE.test(id)) return error(400, "Invalid id.");
  if (!(await deleteSession(key, id))) return error(404, "Session not found.");
  return new Response(null, { status: 204 });
});
