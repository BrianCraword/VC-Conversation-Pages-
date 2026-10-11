import { apiInitializer } from "discourse/lib/api";

const TOPIC_CLASS = "vc-conversation-topic";
const MICROPOST_CLASS = "vc-conversation-micropost";
const QUIET_TITLE_CLASS = "vc-conversation-quiet-title";

function categoryIds(value) {
  const values = Array.isArray(value) ? value : String(value || "").split("|");

  return values
    .map((value) => parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function clearConversationState() {
  document.body.classList.remove(
    TOPIC_CLASS,
    MICROPOST_CLASS,
    QUIET_TITLE_CLASS
  );
  delete document.body.dataset.vcConversationCategoryId;
}

export default apiInitializer("1.8.0", (api) => {
  if (!settings.vc_conversation_pages_enabled) {
    clearConversationState();
    return;
  }

  const router = api.container.lookup("service:router");
  const siteSettings = api.container.lookup("service:site-settings");

  function eligibleCategoryIds() {
    const overrideIds = categoryIds(settings.vc_conversation_category_ids);
    if (overrideIds.length > 0) {
      return overrideIds;
    }

    // REVISION MARKER (0.1.0): inherit the plugin setting instead of
    // maintaining a second list. Revisit only if conversation pages need a
    // deliberately different editorial scope from the Feed itself.
    if (!siteSettings?.vc_feed_enabled) {
      return [];
    }

    return categoryIds(siteSettings.vc_feed_categories);
  }

  function applyConversationState() {
    if (!router?.currentRouteName?.startsWith("topic.")) {
      clearConversationState();
      return;
    }

    const topic = api.container.lookup("controller:topic")?.model;
    const categoryId = Number(topic?.category_id ?? topic?.category?.id);
    const eligible = eligibleCategoryIds().includes(categoryId);

    if (!eligible) {
      clearConversationState();
      return;
    }

    const isMicropost = topic?.is_micropost === true;
    const quietTitle =
      isMicropost && !settings.vc_conversation_emphasize_micropost_titles;

    document.body.classList.add(TOPIC_CLASS);
    document.body.classList.toggle(MICROPOST_CLASS, isMicropost);
    document.body.classList.toggle(QUIET_TITLE_CLASS, quietTitle);
    document.body.dataset.vcConversationCategoryId = String(categoryId);
  }

  api.onPageChange(() => {
    // The page-change event normally fires after the topic model is ready.
    // The second pass protects category-to-topic transitions on slower clients
    // without observing or rewriting Discourse's DOM.
    requestAnimationFrame(applyConversationState);
    setTimeout(applyConversationState, 150);
  });

  requestAnimationFrame(applyConversationState);
});
