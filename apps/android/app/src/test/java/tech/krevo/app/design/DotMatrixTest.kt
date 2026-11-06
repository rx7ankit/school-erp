package tech.krevo.app.design

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DotMatrixTest {
    @Test fun theSameCellAlwaysGetsTheSameNumberBetweenZeroAndOne() {
        for (r in 0..40) for (c in 0..40) {
            val h = cellHash(r, c)
            assertEquals(h, cellHash(r, c), 0.0)
            assertTrue(h >= 0.0 && h < 1.0)
        }
    }

    @Test fun neighbouringCellsDiffer() {
        assertTrue((0..20).map { cellHash(3, it) }.toSet().size > 10)
    }
}
