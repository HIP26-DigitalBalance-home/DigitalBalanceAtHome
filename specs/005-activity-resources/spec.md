# Feature Specification: Activity Resources

**Feature Branch**: `005-activity-resources`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "A feature that allows, when creating an activity, to add external (links) and internal (text field + photos) resources related to it. the idea here is that doing activities can have overhead in some cases (e.g. when making cookies, one needs to find a recipe) that we can save the parent's by embedding information relevant, thus brining us closer to the goal of facilitating quality parent-child time."

## Summary

Doing an activity often carries hidden preparation overhead — finding a cookie recipe, locating a nearby park, remembering which supplies to bring. That overhead is friction between a parent's intention and actual offline time with their child. This feature lets whoever creates an activity attach helpful **resources** to it so that friction is removed before it starts. Two kinds of resources are supported: **external resources** (links to a recipe, a how-to page, a location) and **internal resources** (a written note plus optional photos, such as step-by-step instructions or a reference image). When a parent later opens the activity, these resources are right there — no separate search, no leaving the moment to hunt for information. The goal is to shorten the distance between "let's do this" and actually doing it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Attach resources while creating an activity (Priority: P1)

A parent creating a new activity adds the information a future doer will need to get started quickly. For a baking activity they paste a link to a favorite recipe and write a short note ("we use half the sugar") with a photo of the finished cookies. Resources are added inline as part of the activity creation flow, alongside the activity's title, description, and other details.

**Why this priority**: This is the authoring surface that makes the whole feature possible. Without a way to attach resources during creation, nothing downstream exists. It is independently valuable because a well-resourced activity is more complete and more likely to be attempted.

**Independent Test**: Create an activity, add one external link and one internal note with a photo, save, and verify the activity is stored with both resources associated with it.

**Acceptance Scenarios**:

1. **Given** a parent is creating an activity, **When** they add an external link with a web address and a short label, **Then** the link is attached to the activity and shown in the list of resources for that activity.
2. **Given** a parent is creating an activity, **When** they add an internal resource consisting of a text note and one or more photos, **Then** the note and photos are attached to the activity as a single internal resource.
3. **Given** a parent is creating an activity, **When** they add several resources of both kinds, **Then** all of them are saved and associated with the activity in the order the parent added them.
4. **Given** a parent is creating an activity, **When** they add no resources at all, **Then** the activity is created normally with an empty resource list.
5. **Given** a parent enters an external link that is not a valid web address, **When** they try to save it, **Then** they receive a clear message and the invalid link is not attached.
6. **Given** a parent adds a photo to an internal resource, **When** the photo is still being prepared, **Then** the activity can still be created and the photo appears once it is ready.

---

### User Story 2 - Use attached resources when doing an activity (Priority: P1)

A parent who has chosen to do an activity opens it and sees the resources the creator attached. External links open the referenced page (a recipe, a map, a how-to). Internal notes and photos are displayed inline so the parent can read the instructions and glance at the reference image without leaving the app. The parent no longer has to search the web or ask around before starting.

**Why this priority**: This is where the value is realized. The whole point of attaching resources is to save the doer's time and reduce overhead at the moment of doing. It is independently valuable and independently testable given an activity that already has resources.

**Independent Test**: Open an activity that has one external link and one internal note with a photo, and verify the link is followable and the note text and photo are visible inline.

**Acceptance Scenarios**:

1. **Given** an activity has an external link, **When** a parent opens the activity, **Then** the link is shown with its label and can be followed to the external page.
2. **Given** an activity has an internal resource with text and photos, **When** a parent opens the activity, **Then** the note text and its photos are displayed inline within the activity view.
3. **Given** an activity has multiple resources, **When** a parent opens the activity, **Then** all resources are presented in a clear, scannable list in their saved order.
4. **Given** an activity has no resources, **When** a parent opens the activity, **Then** no resource section is shown (or an empty state that does not distract from the activity).
5. **Given** an activity is accessible to a parent through a group challenge, **When** that parent opens the activity, **Then** they see the same attached resources the creator added.
6. **Given** an external link points to a page that is no longer reachable, **When** the parent follows it, **Then** the app's behavior is unaffected and the failure is handled by the external browser, not the app.

---

### User Story 3 - Update or remove resources on an activity you own (Priority: P2)

The parent who created an activity later refines its resources — swapping a broken recipe link, fixing a typo in a note, adding a better reference photo, or removing something no longer relevant.

**Why this priority**: Resources drift over time (links rot, notes improve). Being able to maintain them keeps the activity useful, but the feature delivers value even before editing exists, so this is secondary to authoring and consuming.

**Independent Test**: On an owned activity that has resources, change a link's label, delete one resource, add a new one, and verify the changes persist and are reflected when the activity is next opened.

**Acceptance Scenarios**:

1. **Given** a parent owns an activity with resources, **When** they edit a resource's label, note text, or link address, **Then** the change is saved and shown afterward.
2. **Given** a parent owns an activity with resources, **When** they remove a resource, **Then** it no longer appears for anyone who opens the activity.
3. **Given** a parent removes a photo from an internal resource, **When** the change is saved, **Then** the stored photo is deleted and no longer served.
4. **Given** a parent does not own an activity (e.g., a curated activity or one created by another family), **When** they open it, **Then** they can view its resources but cannot edit or remove them.

---

### Edge Cases

- What happens when a parent adds many resources or a very long note? The system enforces reasonable per-activity and per-field limits and communicates them before saving fails.
- What happens when an internal resource has text but no photo, or a photo but no text? Both are valid; at least one of the two must be present for the resource to be meaningful.
- What happens when an external link uses a non-web scheme (e.g., a file path or an app-specific scheme)? Only standard web addresses are accepted; others are rejected with a clear message.
- What happens to an activity's resources when the activity itself is deleted? All associated resources, including stored photos, are removed with it.
- What happens to resource photos when a family exercises its right to erasure? Resource photos authored by that family are deleted along with the family's other content within the required window.
- How are external links presented so a parent understands they are leaving the app to a third-party site? Links clearly indicate they lead to an external destination.
- Can a resource photo be reused or referenced by more than one activity? No — each resource photo belongs to exactly one internal resource on one activity.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The activity creation flow MUST let the creator attach zero or more resources to the activity being created.
- **FR-002**: The system MUST support two resource kinds: an **external resource** (a web link with an optional human-readable label) and an **internal resource** (a text note with zero or more photos).
- **FR-003**: An internal resource MUST contain at least one of: note text or at least one photo; a resource with neither MUST be rejected.
- **FR-004**: The system MUST validate that an external resource's address is a well-formed web (http/https) address and reject other schemes or malformed addresses with a clear message.
- **FR-005**: The system MUST preserve and present resources in the order the creator added them.
- **FR-006**: When a parent views an activity, the system MUST display its attached resources: external links as followable labeled links, internal resources with their note text and photos shown inline.
- **FR-007**: External links MUST be visibly marked as leading to an external, third-party destination.
- **FR-008**: The system MUST store and serve resource photos through the same privacy-preserving mechanism used for other user photos (EU-hosted storage, time-limited access, never served directly and permanently through the API).
- **FR-009**: Resource photos that are still being prepared MUST NOT block activity creation; the photo MUST appear for viewers once it is ready.
- **FR-010**: Any parent who can access an activity (through their family or a shared group challenge) MUST be able to view that activity's resources.
- **FR-011**: Only the creator (owner) of an activity MUST be able to add, edit, or remove that activity's resources; other parents have view-only access.
- **FR-012**: The owner MUST be able to edit a resource's label, note text, and link address, and MUST be able to remove any resource.
- **FR-013**: Removing an internal resource or one of its photos MUST permanently delete the corresponding stored photo so it is no longer served.
- **FR-014**: Deleting an activity MUST delete all of its resources, including associated stored photos.
- **FR-015**: When a family's data is erased, resource photos and internal resource content authored by that family MUST be deleted within the project's erasure window.
- **FR-016**: The system MUST enforce reasonable limits on the number of resources per activity, the number of photos per internal resource, and the length of note text and labels, and MUST communicate a limit before a save fails.
- **FR-017**: The system MUST NOT fetch, preview, or render the contents of external links on the parent's behalf, avoiding leaking parent activity to third parties; only user-initiated navigation loads external pages.

### Key Entities *(include if feature involves data)*

- **Activity Resource**: A helpful item attached to a specific Activity to reduce doing overhead. Belongs to exactly one Activity. Has a kind (external or internal), a display order, and audit timestamps. An **external** resource holds a web address and an optional label. An **internal** resource holds optional note text and zero or more Resource Photos (with the "at least one of text/photo" rule).
- **Resource Photo**: An image belonging to exactly one internal Activity Resource. Managed with the same lifecycle and privacy controls as other user-uploaded photos (preparation state, time-limited access URLs, hard deletion). Not shared across resources or activities.
- **Activity** (existing): Gains an association to zero or more Activity Resources. Ownership (creator/family) governs who may edit resources; accessibility (family or shared group challenge) governs who may view them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A parent can attach an external link and an internal note-with-photo to an activity during creation without leaving the creation flow, in under one minute of added effort.
- **SC-002**: 100% of activities that have attached resources display those resources to every parent who can access the activity.
- **SC-003**: A parent doing a resourced activity can reach the creator's linked information (recipe, location, how-to) in one tap from the activity view, without searching outside the app.
- **SC-004**: Among activities that have at least one resource, parents report reduced preparation effort compared to unresourced activities (measured via user testing task-completion time or self-reported effort).
- **SC-005**: Invalid external links and empty internal resources are rejected 100% of the time with a message the parent can act on.
- **SC-006**: When an activity or a family's data is deleted, 0 orphaned resource photos remain in storage after the erasure window.

## Assumptions

- The feature attaches to the existing activity-creation surface. Its primary user is a parent creating a family (user-created) activity; curated/global activities may also carry resources authored by the content team, presented to parents the same way and read-only to them.
- Resource photos reuse the project's existing photo pipeline (EU-hosted object storage, pre-signed time-limited URLs, preparation states, hard deletion), rather than introducing a new storage mechanism.
- External links are stored as-is and are never fetched, previewed, or link-unfurled by the system, consistent with the no-third-party-tracking privacy stance; the parent's device/browser loads them only on explicit tap.
- "Resources" are informational aids only; they do not change scoring, challenge progress, collages, or completion logic.
- Reasonable default limits (subject to refinement during planning): a small number of resources per activity, a handful of photos per internal resource, and short-to-moderate text lengths for labels and notes — chosen to keep the activity view scannable and storage bounded.
- Ownership and access rules follow existing project semantics: the creating parent/family owns editing rights; visibility follows the activity's existing accessibility (own family, plus any group challenge the activity is part of).
- Editing resources after creation (User Story 3) is in scope for the feature but may be delivered after the create/view slices.
