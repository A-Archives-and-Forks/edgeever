export default {
  activate(context) {
    const disposeNote = context.events.on("note.updated", ({ note }) => {
      globalThis.edgeeverPluginObservedNote = note;
    });
    const disposeTemplate = context.events.on("template.created", ({ template }) => {
      globalThis.edgeeverPluginObservedTemplate = template;
    });
    return () => {
      disposeNote();
      disposeTemplate();
    };
  },
};
