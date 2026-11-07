/* Convention: tools named ask_* or confirm_* have no execute — the UI answers them with
 * addToolOutput and the chat resumes automatically. Everything else runs on the server. */
export const isClientTool = (name: string) => /^(ask|confirm)_/.test(name);
