import type { Command } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { canJoin } from "@tiptap/pm/transform";
import {
  groupConsecutiveImagesIntoGalleries,
  IMAGE_GALLERY_NODE_TYPE,
  type TiptapNode,
} from "@edgeever/shared";
import type { ResourceInsertionTarget } from "./resource-insertion-target";

/** Insert a batch and extend only galleries immediately beside the new media. */
export const insertUploadedResources = (
  target: ResourceInsertionTarget,
  content: TiptapNode[],
  updateSelection: boolean,
): Command => ({ tr, commands, dispatch }) => {
  const nodes = groupConsecutiveImagesIntoGalleries(content).map((node) => tr.doc.type.schema.nodeFromJSON(node));
  if (!commands.insertContentAt(target, Fragment.from(nodes), { updateSelection })) return false;
  if (!dispatch) return true;

  // Track the actual inserted nodes, not URLs: an older occurrence of the same
  // image elsewhere in the note must never be regrouped by this upload.
  const inserted = new Set(nodes);
  const candidates: Array<{ node: ProseMirrorNode; pos: number }> = [];
  tr.doc.forEach((node, pos) => {
    if (inserted.has(node) && (node.type.name === "image" || node.type.name === IMAGE_GALLERY_NODE_TYPE)) {
      candidates.push({ node, pos });
    }
  });

  // Work backwards so later joins do not invalidate earlier positions. Never
  // cross paragraphs/attachments or combine two pre-existing galleries.
  for (const { node, pos } of candidates.reverse()) {
    const before = tr.doc.resolve(pos).nodeBefore;
    const after = tr.doc.resolve(pos + node.nodeSize).nodeAfter;
    const previousGallery = before?.type.name === IMAGE_GALLERY_NODE_TYPE && !inserted.has(before) ? before : null;
    const nextGallery = after?.type.name === IMAGE_GALLERY_NODE_TYPE && !inserted.has(after) ? after : null;
    const neighbor = previousGallery ?? nextGallery;
    if (!neighbor) continue;

    // Wrap only the new singleton, then join containers. Unlike replacing the
    // entire old gallery, joining maps existing selections within it correctly.
    if (node.type.name === "image") {
      const range = tr.doc.resolve(pos).blockRange(tr.doc.resolve(pos + node.nodeSize));
      if (!range) continue;
      tr.wrap(range, [{ type: neighbor.type, attrs: neighbor.attrs }]);
    } else if (!previousGallery) {
      tr.setNodeMarkup(pos, undefined, neighbor.attrs);
    }
    const joinAt = previousGallery ? pos : pos + tr.doc.nodeAt(pos)!.nodeSize;
    if (canJoin(tr.doc, joinAt)) tr.join(joinAt);
  }
  return true;
};
