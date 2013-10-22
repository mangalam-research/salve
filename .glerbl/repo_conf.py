checks = {
    'pre-commit': [
        # BEFORE_COMMIT in the root of the working tree can be used as
        # reminder to do something before the next commit.
        "no_before_commit",

        # We only allow ASCII filenames.
        "no_non_ascii_filenames",

        # We don't allow trailing whitespaces.
        "no_trailing_whitespace",
    ]
}
