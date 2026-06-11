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


class NoDeletionPending(DomainError):
    status_code = 409
    code = "no_deletion_pending"


class ConsentVersionMismatch(DomainError):
    status_code = 403
    code = "consent_version_mismatch"
