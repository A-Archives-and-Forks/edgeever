import { mergeAttributes, Node } from "@tiptap/core";
import type { TiptapNode } from "./content";

export const IMAGE_GALLERY_NODE_TYPE = "edgeeverImageGallery" as const;
export const IMAGE_GALLERY_LAYOUTS = ["auto", "2", "3"] as const;
export type ImageGalleryLayout = (typeof IMAGE_GALLERY_LAYOUTS)[number];

export const resolveImageGalleryLayout = (value: unknown): ImageGalleryLayout =>
  IMAGE_GALLERY_LAYOUTS.includes(value as ImageGalleryLayout)
    ? (value as ImageGalleryLayout)
    : "auto";

/**
 * A rich-editor-only layout container. Markdown deliberately serializes its
 * children as ordinary sequential images so exports stay portable.
 */
export const ImageGallery = Node.create({
  name: IMAGE_GALLERY_NODE_TYPE,
  group: "block",
  content: "image+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      layout: {
        default: "auto",
        parseHTML: (element: HTMLElement) => resolveImageGalleryLayout(
          element.getAttribute("data-image-gallery-layout"),
        ),
        renderHTML: (attributes: { layout?: unknown }) => ({
          "data-image-gallery-layout": resolveImageGalleryLayout(attributes.layout),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-edgeever-image-gallery]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-edgeever-image-gallery": "true",
        "data-image-count": String(node.childCount),
      }),
      0,
    ];
  },

  renderMarkdown(node, helpers) {
    return helpers.renderChildren(node.content ?? [], "\n\n");
  },
});

const createGalleryNode = (images: TiptapNode[]): TiptapNode => ({
  type: IMAGE_GALLERY_NODE_TYPE,
  attrs: { layout: "auto" },
  content: images,
});

/** Groups only adjacent image runs and preserves all surrounding node order. */
export const groupConsecutiveImagesIntoGalleries = (nodes: TiptapNode[]): TiptapNode[] => {
  const grouped: TiptapNode[] = [];
  let images: TiptapNode[] = [];

  const flushImages = () => {
    if (images.length === 1) {
      grouped.push(images[0]!);
    } else if (images.length > 1) {
      grouped.push(createGalleryNode(images));
    }
    images = [];
  };

  for (const node of nodes) {
    if (node.type === "image") {
      images.push(node);
      continue;
    }
    flushImages();
    grouped.push(node);
  }
  flushImages();

  return grouped;
};
