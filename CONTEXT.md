# Strategy Flow Input

Strategy Flow Input is the generic strategy orchestration contract for expressing responsibility, object state, explicit transitions, and board presentation facts as JSON.

## Language

**Flow Card**:
A strategy step that states who is responsible and the object's state at that step.
_Avoid_: Node in business conversation

**Board Column**:
A required stage grouping that places flow cards in the same board column.
_Avoid_: Stage when used as a separate data concept

**Business Track**:
An optional business mainline used to distinguish multiple lines of work in a complex strategy.
_Avoid_: Lane, component group

**Primary Track Membership**:
The single explicit Business Track that owns a Flow Card when Business Tracks are enabled.
_Avoid_: Secondary track, multi-track membership

**No-Track Document**:
A complete strategy document that intentionally omits Business Tracks and card track membership.
_Avoid_: Incomplete document, pre-track document

**Card Multi-Selection**:
A user's current set of selected Flow Cards, which may also coexist with other selected editor objects.
_Avoid_: Temporary card group

**Bulk Assignment**:
An explicit operation that writes one Board Column or Primary Track Membership to every Flow Card in a Card Multi-Selection.
_Avoid_: Marking, tagging
