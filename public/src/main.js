import { showModal } from "./ui/modal.js";
import { initButton } from "./ui/button.js";
import { VoiceAssistant } from "./assistant/voiceAssistant.js";
import { assistantConfig } from "./assistant/config.js";

const assistant = new VoiceAssistant(assistantConfig);

initButton(async () => {
  showModal();
  await assistant.init();
});
