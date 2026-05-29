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
