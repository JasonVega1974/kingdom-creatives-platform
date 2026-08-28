"use client";

import { useActionState, useState } from "react";

import {
  addGroup,
  moveGroup,
  removeGroup,
  setGroupVisible,
  updateGroup,
} from "@/app/(portal)/portal/groups/actions";
import {
  AddCard,
  ConfirmRemove,
  EmptyList,
  Field,
  MoveButtons,
  SaveRow,
  SelectField,
  TextArea,
  VisibleCheckbox,
} from "@/components/portal/editor-kit";
import { TEAM_IDLE } from "@/lib/portal/form-state";

/**
 * ============================================================
 * GROUPS & STUDIES
 * ============================================================
 *
 * Built from the shared editor kit.
 *
 * Ordered by hand, unlike sermons and events. A groups list has no natural
 * chronology, and a pastor putting the newcomers' study first is making an
 * editorial choice the public page should keep - so this tab has the move
 * buttons and those two do not.
 */

export type GroupRow = {
  id: string;
  name: string;
  description: string;
  leaderName: string;
  meetingDay: string;
  meetingTime: string;
  meetingTz: string;
  meetingLink: string;
  locationType: string;
  locationDetail: string;
  frequency: string;
  visible: boolean;
};

/** Drives the public /groups filter strip. A value outside this set is
    unreachable from the filters, so it is a picker rather than free text. */
const LOCATION_TYPES = [
  { value: "in_person", label: "In person" },
  { value: "video", label: "Video call" },
  { value: "phone", label: "Phone" },
];

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Every two weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "occasional", label: "Now and then" },
];

const DAYS = [
  { value: "", label: "No fixed day" },
  { value: "Sunday", label: "Sunday" },
  { value: "Monday", label: "Monday" },
  { value: "Tuesday", label: "Tuesday" },
  { value: "Wednesday", label: "Wednesday" },
  { value: "Thursday", label: "Thursday" },
  { value: "Friday", label: "Friday" },
  { value: "Saturday", label: "Saturday" },
];

export function GroupsEditor({ groups }: { groups: GroupRow[] }) {
  return (
    <div className="space-y-5">
      <AddGroup />

      {groups.length === 0 ? (
        <EmptyList>
          No groups yet. Add your first one above - it stays off your website
          until you switch it on.
        </EmptyList>
      ) : (
        groups.map((group, index) => (
          <GroupCard
            key={group.id}
            group={group}
            isFirst={index === 0}
            isLast={index === groups.length - 1}
          />
        ))
      )}
    </div>
  );
}

function AddGroup() {
  const [state, action] = useActionState(addGroup, TEAM_IDLE);

  return (
    <AddCard label="+ Add a group">
      <form action={action} className="space-y-4">
        <GroupFields />
        <p className="text-sm text-[var(--kc-ink-soft)]">
          New groups stay off your website until you switch them on.
        </p>
        <SaveRow label="Add" state={state} />
      </form>
    </AddCard>
  );
}

function GroupCard({
  group,
  isFirst,
  isLast,
}: {
  group: GroupRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, action] = useActionState(updateGroup, TEAM_IDLE);
  const [open, setOpen] = useState(false);

  const when = [group.meetingDay, group.meetingTime, group.meetingTz]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{group.name}</h2>
          <p className="text-sm text-[var(--kc-ink-soft)]">
            {[group.leaderName, when].filter(Boolean).join(" - ") ||
              "No leader or time set"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <MoveButtons
            isFirst={isFirst}
            isLast={isLast}
            onMove={(direction) => moveGroup(group.id, direction)}
          />
          <VisibleCheckbox
            itemName={group.name}
            visible={group.visible}
            onToggle={(next) => setGroupVisible(group.id, next)}
          />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : "Edit"}
          </button>
          <ConfirmRemove
            itemName={group.name}
            onRemove={() => removeGroup(group.id)}
          />
        </div>
      </div>

      {open ? (
        <form action={action} className="mt-5 space-y-4 border-t border-[var(--kc-line)] pt-5">
          <input type="hidden" name="id" value={group.id} />
          <GroupFields group={group} />
          <SaveRow label="Save" state={state} />
        </form>
      ) : null}
    </section>
  );
}

function GroupFields({ group }: { group?: GroupRow }) {
  return (
    <>
      <Field name="name" label="Group name" defaultValue={group?.name} required />
      <Field name="leader_name" label="Who leads it" defaultValue={group?.leaderName} />
      <TextArea name="description" label="What it is" defaultValue={group?.description} />

      <SelectField
        name="location_type"
        label="How it meets"
        options={LOCATION_TYPES}
        defaultValue={group?.locationType || "in_person"}
        hint="visitors can filter by this"
      />
      <Field
        name="location_detail"
        label="Where exactly"
        defaultValue={group?.locationDetail}
        hint="a room, a truck stop, or how to dial in"
      />
      <Field
        name="meeting_link"
        label="Join link"
        defaultValue={group?.meetingLink}
        hint="for video or phone groups"
      />

      <SelectField
        name="frequency"
        label="How often"
        options={FREQUENCIES}
        defaultValue={group?.frequency || "weekly"}
      />
      <SelectField
        name="meeting_day"
        label="Which day"
        options={DAYS}
        defaultValue={group?.meetingDay}
      />
      <Field
        name="meeting_time"
        label="What time"
        defaultValue={group?.meetingTime}
        hint="7:00 PM"
      />
      <Field
        name="meeting_tz"
        label="Timezone"
        defaultValue={group?.meetingTz}
        hint="CT, ET - drivers are in every zone"
      />
    </>
  );
}
