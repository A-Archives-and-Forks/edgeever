import { useCallback } from "react";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from "@tiptap/react";
import { useTranslation } from "react-i18next";
import {
  ImageGallery,
  IMAGE_GALLERY_LAYOUTS,
  resolveImageGalleryLayout,
  type ImageGalleryLayout,
} from "@edgeever/shared";
import { cn } from "@/lib/utils";

const ImageGalleryNodeView = ({ editor, getPos, node, selected, updateAttributes }: NodeViewProps) => {
  const { t } = useTranslation();
  const layout = resolveImageGalleryLayout(node.attrs.layout);
  const isEditable = useEditorState({
    editor,
    selector: ({ editor: activeEditor }) => activeEditor.isEditable,
  });

  const ungroup = useCallback(() => {
    const position = getPos();
    if (typeof position !== "number") return;

    editor.view.dispatch(
      editor.state.tr.replaceWith(position, position + node.nodeSize, node.content),
    );
    editor.commands.focus(Math.min(position + 1, editor.state.doc.content.size));
  }, [editor, getPos, node]);

  const setLayout = useCallback((nextLayout: ImageGalleryLayout) => {
    updateAttributes({ layout: nextLayout });
  }, [updateAttributes]);

  return (
    <NodeViewWrapper
      className={cn("edgeever-image-gallery", selected && "is-selected")}
      data-edgeever-image-gallery="true"
      data-image-count={node.childCount}
      data-image-gallery-layout={layout}
    >
      {isEditable ? (
        <div
          className="edgeever-image-gallery__toolbar"
          contentEditable={false}
          aria-label={t("editor.imageGallery.toolbar")}
          role="toolbar"
        >
          {IMAGE_GALLERY_LAYOUTS.map((item) => (
            <button
              key={item}
              type="button"
              className={cn(
                "edgeever-image-gallery__button",
                layout === item && "is-active",
              )}
              aria-pressed={layout === item}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setLayout(item)}
            >
              {t(`editor.imageGallery.layouts.${item}`)}
            </button>
          ))}
          <span className="edgeever-image-gallery__separator" aria-hidden="true" />
          <button
            type="button"
            className="edgeever-image-gallery__button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={ungroup}
          >
            {t("editor.imageGallery.ungroup")}
          </button>
        </div>
      ) : null}
      <NodeViewContent className="edgeever-image-gallery__content" />
    </NodeViewWrapper>
  );
};

export const EditableImageGallery = ImageGallery.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageGalleryNodeView);
  },
});
