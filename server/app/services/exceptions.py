class DomainError(Exception):
    status_code: int = 400
    code: str = "domain_error"


class FamilyNotFound(DomainError):
    status_code = 404
    code = "family_not_found"


class MemberNotFound(DomainError):
    status_code = 404
    code = "member_not_found"


class InviteExpired(DomainError):
    status_code = 400
    code = "invite_expired"


class InviteAlreadyUsed(DomainError):
    status_code = 400
    code = "invite_already_used"


class InviteNotFound(DomainError):
    status_code = 404
    code = "invite_not_found"


class AlreadyFamilyMember(DomainError):
    status_code = 409
    code = "already_family_member"


class LastAdminError(DomainError):
    status_code = 400
    code = "last_admin"


class NotFamilyMember(DomainError):
    status_code = 403
    code = "not_family_member"


class NotFamilyAdmin(DomainError):
    status_code = 403
    code = "not_family_admin"


class ChildNotFound(DomainError):
    status_code = 404
    code = "child_not_found"


class NoFamilyError(DomainError):
    status_code = 400
    code = "no_family"


class GroupNotFound(DomainError):
    status_code = 404
    code = "group_not_found"


class NotGroupMember(DomainError):
    status_code = 403
    code = "not_group_member"


class NotGroupAdmin(DomainError):
    status_code = 403
    code = "not_group_admin"


class AlreadyGroupMember(DomainError):
    status_code = 409
    code = "already_group_member"


class LastGroupAdminError(DomainError):
    status_code = 400
    code = "last_group_admin"


class GroupInviteNotFound(DomainError):
    status_code = 404
    code = "group_invite_not_found"


class GroupInviteExpired(DomainError):
    status_code = 400
    code = "group_invite_expired"


class GroupInviteAlreadyUsed(DomainError):
    status_code = 400
    code = "group_invite_already_used"


class ChallengeNotFound(DomainError):
    status_code = 404
    code = "challenge_not_found"


class ActivityNotFound(DomainError):
    status_code = 404
    code = "activity_not_found"


class InvalidDateRange(DomainError):
    status_code = 400
    code = "invalid_date_range"


class AlreadyCompleted(DomainError):
    status_code = 409
    code = "already_completed"


class PhotoLimitReached(DomainError):
    status_code = 429
    code = "photo_limit_reached"


class JournalEntryExists(DomainError):
    status_code = 409
    code = "journal_entry_exists"


class NoDeletionPending(DomainError):
    status_code = 409
    code = "no_deletion_pending"


class ConsentVersionMismatch(DomainError):
    status_code = 403
    code = "consent_version_mismatch"


class UserNotFound(DomainError):
    status_code = 404
    code = "user_not_found"


class NotFriend(DomainError):
    status_code = 403
    code = "not_friend"


class AlreadyParticipant(DomainError):
    status_code = 409
    code = "already_participant"


class CannotReuploadSelfReported(DomainError):
    status_code = 400
    code = "cannot_reupload_self_reported"


class PhotoStillProcessing(DomainError):
    status_code = 409
    code = "photo_still_processing"


class DurationRequired(DomainError):
    status_code = 400
    code = "duration_required"


class InvalidDuration(DomainError):
    status_code = 400
    code = "invalid_duration"


class CompletionNotPending(DomainError):
    status_code = 409
    code = "completion_not_pending"


class RewardLevelNotFound(DomainError):
    status_code = 404
    code = "reward_level_not_found"


class LevelLocked(DomainError):
    status_code = 409
    code = "level_locked"


class AlreadyRedeemedThisQuarter(DomainError):
    status_code = 409
    code = "already_redeemed_this_quarter"


class AnnualCapReached(DomainError):
    status_code = 409
    code = "annual_cap_reached"


class ChoiceRequired(DomainError):
    status_code = 400
    code = "choice_required"
